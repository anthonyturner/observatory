import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type {
  DeploymentMark,
  DeploymentQuery,
  DeploymentReader,
  DeploymentStatusMark,
} from '../github/deployment-reader.ts';
import { deploymentView, outcomeOf } from './deployment-view.ts';
import {
  HISTORY_LENGTH,
  deploymentsReport,
  isPreviewUnsettled,
  isReportBuilding,
  pullPreview,
} from './deployments-report.ts';

const SHA = 'a'.repeat(40);
const NOW = Date.parse('2026-10-08T13:00:00Z');

const mark = (id: number, environment: string, minute: number, sha = SHA): DeploymentMark => ({
  id,
  environment,
  sha,
  ref: sha,
  createdAt: `2026-10-08T12:${String(minute).padStart(2, '0')}:00Z`,
  creator: 'vercel[bot]',
});

const status = (state: DeploymentStatusMark['state']): DeploymentStatusMark => ({
  state,
  environmentUrl: 'https://app.vercel.app',
  logUrl: null,
  description: 'Deployment has completed',
  createdAt: '2026-10-08T12:59:00Z',
});

interface Fake {
  readonly environments?: () => Promise<string[]>;
  readonly marks: readonly DeploymentMark[];
  readonly states?: Readonly<Record<number, DeploymentStatusMark['state'] | 'throws'>>;
}

/** A reader over a fixed list, narrowing as GitHub does, recording what it was asked. */
function fakeReader(fake: Fake): DeploymentReader & { asked: DeploymentQuery[] } {
  const asked: DeploymentQuery[] = [];
  return {
    asked,
    environments: fake.environments ?? (async () => ['Preview', 'Production']),
    deployments: async (_repo, query) => {
      asked.push(query);
      return fake.marks
        .filter((each) => query.environment === undefined || each.environment === query.environment)
        .filter((each) => query.sha === undefined || each.sha === query.sha)
        .slice(0, query.limit);
    },
    deploymentStatus: async (_repo, id) => {
      const state = fake.states?.[id] ?? 'success';
      if (state === 'throws') throw new Error('HTTP 502');
      return status(state);
    },
  };
}

describe('deploymentsReport', () => {
  it('puts production first, each environment with its deployments newest first', async () => {
    const github = fakeReader({
      marks: [mark(3, 'Preview', 58), mark(2, 'Production', 50), mark(1, 'Preview', 40)],
      states: { 3: 'in_progress', 1: 'inactive' },
    });

    const report = await deploymentsReport(github, 'me/app', NOW);

    assert.equal(report.generatedAt, '2026-10-08T13:00:00.000Z');
    assert.deepEqual(
      report.environments.map((environment) => [
        environment.name,
        environment.isProduction,
        environment.deployments.map((deployment) => [deployment.id, deployment.outcome]),
      ]),
      [
        ['Production', true, [[2, 'ready']]],
        [
          'Preview',
          false,
          [
            [3, 'building'],
            [1, 'inactive'],
          ],
        ],
      ],
    );
    assert.equal(
      report.environments[1].url,
      'https://github.com/me/app/deployments/activity_log?environments_filter=Preview',
    );
    assert.deepEqual(
      github.asked.map((query) => query.limit),
      [HISTORY_LENGTH, HISTORY_LENGTH],
    );
    assert.equal(isReportBuilding(report), true);
  });

  it('names the environments from the deployments where GitHub keeps none', async () => {
    const notFound = async (): Promise<string[]> => {
      throw new Error('gh: Not Found (HTTP 404)');
    };
    const github = fakeReader({
      environments: notFound,
      marks: [mark(2, 'staging', 50), mark(1, 'github-pages', 40)],
    });

    const report = await deploymentsReport(github, 'me/app', NOW);

    assert.deepEqual(
      report.environments.map((environment) => environment.name),
      ['staging', 'github-pages'],
    );
    assert.equal(isReportBuilding(report), false);
  });

  it('fails when GitHub will not list the environments for another reason', async () => {
    const github = fakeReader({
      environments: async () => {
        throw new Error('HTTP 502');
      },
      marks: [],
    });

    await assert.rejects(deploymentsReport(github, 'me/app', NOW), /HTTP 502/);
  });

  it('keeps an environment with no deployments, and leaves a status it could not read unknown', async () => {
    const github = fakeReader({ marks: [mark(1, 'Preview', 40)], states: { 1: 'throws' } });
    const quiet = console.error;
    console.error = () => undefined;

    try {
      const report = await deploymentsReport(github, 'me/app', NOW);

      assert.deepEqual(
        report.environments.map((environment) => [
          environment.name,
          environment.deployments.map((deployment) => deployment.outcome),
        ]),
        [
          ['Production', []],
          ['Preview', ['unknown']],
        ],
      );
    } finally {
      console.error = quiet;
    }
  });
});

describe('pullPreview', () => {
  it('gives the newest deployment of the commit to each environment', async () => {
    const other = 'b'.repeat(40);
    const github = fakeReader({
      marks: [
        mark(4, 'Preview', 55),
        mark(3, 'Preview', 50),
        mark(2, 'QA', 45),
        mark(1, 'Preview', 59, other),
      ],
      states: { 4: 'queued' },
    });

    const preview = await pullPreview(github, 'me/app', SHA);

    assert.equal(preview.sha, SHA);
    assert.deepEqual(
      preview.deployments.map((deployment) => [deployment.id, deployment.outcome]),
      [
        [4, 'building'],
        [2, 'ready'],
      ],
    );
    assert.equal(isPreviewUnsettled(preview), true);
  });

  it('is unsettled with nothing deployed yet, and settled once every one has gone live', async () => {
    const none = await pullPreview(fakeReader({ marks: [] }), 'me/app', SHA);
    const live = await pullPreview(fakeReader({ marks: [mark(1, 'Preview', 40)] }), 'me/app', SHA);

    assert.equal(isPreviewUnsettled(none), true);
    assert.equal(isPreviewUnsettled(live), false);
  });
});

describe('deploymentView', () => {
  it('links the commit, and names a ref only when it is not the commit itself', () => {
    const view = deploymentView('me/app', { ...mark(1, 'Preview', 40), ref: 'main' }, null);

    assert.equal(view.commitUrl, `https://github.com/me/app/commit/${SHA}`);
    assert.equal(view.ref, 'main');
    assert.equal(view.url, null);
    assert.equal(view.statusAt, null);
    assert.equal(deploymentView('me/app', mark(1, 'Preview', 40), null).ref, null);
  });

  it('reads each of GitHub’s states as the outcome it shows', () => {
    const outcomes = (
      ['success', 'queued', 'pending', 'in_progress', 'error', 'failure', 'inactive'] as const
    ).map((state) => outcomeOf(status(state)));

    assert.deepEqual(outcomes, [
      'ready',
      'building',
      'building',
      'building',
      'failed',
      'failed',
      'inactive',
    ]);
    assert.equal(outcomeOf(null), 'unknown');
  });
});
