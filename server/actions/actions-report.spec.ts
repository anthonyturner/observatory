import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { RunJob, WorkflowRun } from '../github/actions-reader.ts';
import type { CheckAttempt } from '../github/check-history.ts';
import {
  type ActionsSources,
  actionsJobOf,
  actionsReport,
  flakyCommits,
  workflowUrl,
} from './actions-report.ts';

const SHA_A = 'a'.repeat(40);
const SHA_B = 'b'.repeat(40);

const run = (id: number, extra: Partial<WorkflowRun> = {}): WorkflowRun => ({
  id,
  workflowId: 9,
  workflowName: 'CI',
  title: 'Add a thing',
  number: id,
  attempt: 1,
  event: 'push',
  branch: 'main',
  sha: SHA_A,
  status: 'completed',
  conclusion: 'success',
  actor: 'me',
  createdAt: '2026-10-07T10:00:00Z',
  startedAt: '2026-10-07T10:00:00Z',
  updatedAt: '2026-10-07T10:02:30Z',
  url: `https://github.com/me/app/actions/runs/${id}`,
  ...extra,
});

const attempt = (sha: string, conclusion: string, completedAt: string): CheckAttempt => ({
  name: 'test',
  sha,
  conclusion,
  completedAt,
});

/** Failed and then passed at commit A; only ever failed at commit B. */
const HISTORY: CheckAttempt[] = [
  attempt(SHA_A, 'FAILURE', '2026-10-07T10:01:00Z'),
  attempt(SHA_A, 'SUCCESS', '2026-10-07T10:05:00Z'),
  attempt(SHA_B, 'FAILURE', '2026-10-07T09:01:00Z'),
];

function sources(more: Partial<ActionsSources> = {}): ActionsSources {
  return {
    workflows: async () => [
      { id: 9, name: 'CI', path: '.github/workflows/ci.yml', state: 'active' },
    ],
    workflowRuns: async (_repo, branch) =>
      branch
        ? [run(3, { conclusion: 'failure' })]
        : [run(1, { attempt: 2 }), run(2, { status: 'in_progress', conclusion: null })],
    runJobs: async () => [],
    defaultBranch: async () => 'main',
    checkHistory: async () => HISTORY,
    ...more,
  };
}

describe('workflowUrl', () => {
  it('links a workflow file’s runs, and the Actions tab for one GitHub made', () => {
    assert.equal(
      workflowUrl('me/app', '.github/workflows/ci.yml'),
      'https://github.com/me/app/actions/workflows/ci.yml',
    );
    assert.equal(
      workflowUrl('me/app', 'dynamic/pages/pages-build-deployment'),
      'https://github.com/me/app/actions',
    );
  });
});

describe('flakyCommits', () => {
  it('names the commits where a job failed and then passed', () => {
    assert.deepEqual([...flakyCommits(HISTORY)], [SHA_A]);
  });
});

describe('actionsReport', () => {
  it('reads the runs with outcomes, durations, flaky tags and the branch’s health', async () => {
    const report = await actionsReport(sources(), 'me/app', Date.parse('2026-10-07T11:00:00Z'));

    assert.equal(report.generatedAt, '2026-10-07T11:00:00.000Z');
    assert.deepEqual(
      report.runs.map((each) => [each.id, each.outcome, each.durationS, each.isFlaky]),
      [
        [1, 'passed', 150, true],
        [2, 'running', null, false],
      ],
    );
    assert.deepEqual(report.flakyChecks, ['test']);
    assert.equal(report.workflows[0].isActive, true);
    assert.equal(report.workflows[0].url, 'https://github.com/me/app/actions/workflows/ci.yml');
    assert.deepEqual(report.health, {
      repo: 'me/app',
      branch: 'main',
      state: 'failing',
      failing: ['CI'],
    });
  });

  it('keeps the runs, untagged, when the reruns cannot be read', async () => {
    const original = console.error;
    console.error = () => undefined;
    try {
      const report = await actionsReport(
        sources({
          checkHistory: async () => {
            throw new Error('rate limited');
          },
        }),
        'me/app',
      );

      assert.equal(report.runs.length, 2);
      assert.equal(report.runs[0].isFlaky, false);
      assert.deepEqual(report.flakyChecks, []);
    } finally {
      console.error = original;
    }
  });
});

describe('actionsJobOf', () => {
  it('reads a job’s outcome and duration, and links each step into its log', () => {
    const job: RunJob = {
      id: 5,
      name: 'build',
      status: 'completed',
      conclusion: 'failure',
      url: 'https://github.com/me/app/actions/runs/1/job/5',
      startedAt: '2026-10-07T10:00:00Z',
      completedAt: '2026-10-07T10:01:05Z',
      steps: [{ number: 3, name: 'Test', status: 'completed', conclusion: 'failure' }],
    };

    assert.deepEqual(actionsJobOf(job), {
      id: 5,
      name: 'build',
      outcome: 'failed',
      durationS: 65,
      url: 'https://github.com/me/app/actions/runs/1/job/5',
      steps: [
        {
          number: 3,
          name: 'Test',
          outcome: 'failed',
          url: 'https://github.com/me/app/actions/runs/1/job/5#step:3:1',
        },
      ],
    });
  });
});
