import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createApiHandler } from '../http/api-handler.ts';
import { withActionsRerunRoute } from './actions-rerun.ts';
import type { ActionsReport, ActionsRun } from './actions-types.ts';

const RUN_ID = 18234567890;

const run = (id: number, outcome: ActionsRun['outcome']): ActionsRun => ({
  id,
  workflowId: 9,
  workflow: 'CI',
  title: 'Add a thing',
  number: 1,
  attempt: 1,
  event: 'push',
  branch: 'main',
  sha: 'a'.repeat(40),
  actor: 'me',
  createdAt: '2026-10-07T10:00:00Z',
  startedAt: '2026-10-07T10:00:00Z',
  durationS: 60,
  outcome,
  isFlaky: false,
  url: `https://github.com/me/app/actions/runs/${id}`,
});

const report: ActionsReport = {
  generatedAt: '2026-10-07T11:00:00Z',
  repo: 'me/app',
  workflows: [],
  runs: [run(RUN_ID, 'failed'), run(2, 'passed')],
  flakyChecks: [],
  health: { repo: 'me/app', branch: 'main', state: 'failing', failing: ['CI'] },
};

function setUp(refuse = false) {
  const rerun: number[] = [];
  const forgotten: string[] = [];
  const handle = createApiHandler(
    withActionsRerunRoute(
      { get: {}, post: {} },
      { actions: async () => report, forgetActions: (repo) => forgotten.push(repo) },
      {
        rerunFailedJobs: async (_repo, runId) => {
          if (refuse) throw new Error('HTTP 403 This workflow run is not completed');
          rerun.push(runId);
        },
      },
    ),
  );
  const post = (body: unknown) =>
    handle(
      new Request('http://x/api/actions/rerun', {
        method: 'POST',
        headers: { 'x-observatory': '1', 'content-type': 'application/json' },
        body: JSON.stringify(body),
      }),
    );
  return { post, rerun, forgotten };
}

describe('POST /api/actions/rerun', () => {
  it('reruns a failed run’s failed jobs and forgets the cached runs', async () => {
    const { post, rerun, forgotten } = setUp();

    const response = await post({ repo: 'me/app', run: RUN_ID });

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { run: RUN_ID });
    assert.deepEqual(rerun, [RUN_ID]);
    assert.deepEqual(forgotten, ['me/app']);
  });

  it('refuses a run that did not fail, and one it does not know', async () => {
    const { post, rerun } = setUp();

    assert.equal((await post({ repo: 'me/app', run: 2 })).status, 403);
    assert.equal((await post({ repo: 'me/app', run: 99 })).status, 404);
    assert.equal((await post({ repo: 'me/app', run: 'x' })).status, 400);
    assert.deepEqual(rerun, []);
  });

  it('says why when GitHub will not rerun it', async () => {
    const original = console.error;
    console.error = () => undefined;
    try {
      const { post, forgotten } = setUp(true);

      const response = await post({ repo: 'me/app', run: RUN_ID });

      assert.equal(response.status, 403);
      assert.match(
        String(((await response.json()) as { error: unknown }).error),
        /may still be running/,
      );
      assert.deepEqual(forgotten, ['me/app']);
    } finally {
      console.error = original;
    }
  });
});
