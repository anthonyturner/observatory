import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { CheckRerunner } from '../github/check-rerunner.ts';
import { createApiHandler } from '../http/api-handler.ts';
import type { CheckLine } from './pull-detail.ts';
import type { QueueItem } from './queue-report.ts';
import { type RerunSources, workflowRunIdOf } from './rerun-flaky.ts';
import { RERUN_PATH, withRerunRoute } from './rerun-routes.ts';

const REPO = 'me/app';
const BASE = `http://localhost${RERUN_PATH}`;
const WRITE = { 'x-observatory': '1', 'content-type': 'application/json' };
const RUNS = `https://github.com/${REPO}/actions/runs`;

const item = (number: number, overrides: Partial<QueueItem> = {}): QueueItem => ({
  number,
  title: `Change ${number}`,
  url: `https://github.com/${REPO}/pull/${number}`,
  isDraft: false,
  bucket: 'unreviewed',
  closes: [],
  failingChecks: 2,
  flakyChecks: ['e2e', 'lint'],
  additions: 1,
  deletions: 1,
  updatedAt: '2026-10-01T00:00:00Z',
  branch: `feat/${number}`,
  headSha: 'a'.repeat(40),
  base: 'main',
  mergeable: 'MERGEABLE',
  changedFiles: 1,
  idleDays: 1,
  ageDays: 1,
  ...overrides,
});

const check = (run: string, outcome: CheckLine['outcome'], url: string | null): CheckLine => ({
  name: run,
  run,
  outcome,
  result: outcome === 'failed' ? 'FAILURE' : 'SUCCESS',
  url,
});

const DEFAULT_CHECKS: readonly CheckLine[] = [
  check('e2e', 'failed', `${RUNS}/101/job/1`),
  check('lint', 'failed', `${RUNS}/101/job/2`),
  check('build', 'passed', `${RUNS}/102/job/3`),
];

function setUp(
  items: readonly QueueItem[],
  checks: readonly CheckLine[] = DEFAULT_CHECKS,
  refuses = false,
) {
  const reruns: number[] = [];
  const forgotten: string[] = [];
  const sources: RerunSources = {
    queue: async (repo) => ({ generatedAt: '', repo, items }),
    pull: async () => ({ checks }),
    forgetQueue: (repo) => forgotten.push(`queue ${repo}`),
    forgetPull: (repo, number) => forgotten.push(`pull ${repo}#${number}`),
  };
  const rerunner: CheckRerunner = {
    rerunFailedJobs: async (_repo, runId) => {
      if (refuses) throw new Error('HTTP 403 This workflow is already running');
      reruns.push(runId);
    },
  };
  const handle = createApiHandler(withRerunRoute({ get: {}, post: {} }, sources, rerunner));
  const send = (body: unknown, headers: Record<string, string> = WRITE) =>
    handle(new Request(BASE, { method: 'POST', headers, body: JSON.stringify(body) }));
  return { send, reruns, forgotten };
}

describe('rerun route', () => {
  it('reruns the workflow run holding a pull request’s flaky failures, once', async () => {
    const { send, reruns, forgotten } = setUp([item(7)]);

    const response = await send({ repo: REPO, number: 7 });

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { number: 7, runs: [101] });
    assert.deepEqual(reruns, [101]);
    assert.deepEqual(forgotten, [`pull ${REPO}#7`, `queue ${REPO}`, `pull ${REPO}#7`]);
  });

  it('refuses a pull request that also fails on a check that is not flaky', async () => {
    const { send, reruns } = setUp([item(7, { bucket: 'failing', flakyChecks: ['e2e'] })]);

    const response = await send({ repo: REPO, number: 7 });

    assert.equal(response.status, 403);
    assert.deepEqual(reruns, []);
  });

  it('refuses a pull request that is not failing at all', async () => {
    const { send, reruns } = setUp([item(7, { failingChecks: 0, flakyChecks: [] })]);

    assert.equal((await send({ repo: REPO, number: 7 })).status, 403);
    assert.deepEqual(reruns, []);
  });

  it('answers 404 for a pull request not in the queue', async () => {
    assert.equal((await setUp([item(7)]).send({ repo: REPO, number: 8 })).status, 404);
  });

  it('refuses flaky checks that are not GitHub Actions runs', async () => {
    const { send, reruns } = setUp(
      [item(7)],
      [check('e2e', 'failed', 'https://ci.example.com/1'), check('lint', 'failed', null)],
    );

    const response = await send({ repo: REPO, number: 7 });

    assert.equal(response.status, 403);
    assert.deepEqual(reruns, []);
  });

  it('says so when GitHub will not rerun, and still forgets the cached copies', async (context) => {
    context.mock.method(console, 'error', () => undefined);
    const { send, forgotten } = setUp([item(7)], DEFAULT_CHECKS, true);

    const response = await send({ repo: REPO, number: 7 });

    assert.equal(response.status, 403);
    assert.match(((await response.json()) as { error: string }).error, /workflow run 101/);
    assert.deepEqual(forgotten, [`pull ${REPO}#7`, `queue ${REPO}`, `pull ${REPO}#7`]);
  });

  it('accepts a write only with the header no other site can add', async () => {
    const { send, reruns } = setUp([item(7)]);

    const response = await send({ repo: REPO, number: 7 }, { 'content-type': 'application/json' });

    assert.equal(response.status, 403);
    assert.deepEqual(reruns, []);
  });
});

describe('workflowRunIdOf', () => {
  it('reads the run id from a GitHub Actions job page in the repository', () => {
    assert.equal(workflowRunIdOf(REPO, `${RUNS}/123/job/456`), 123);
    assert.equal(workflowRunIdOf(REPO, `${RUNS}/123`), 123);
  });

  it('has none for another repository, another site, or no page', () => {
    assert.equal(workflowRunIdOf(REPO, 'https://github.com/other/app/actions/runs/1/job/2'), null);
    assert.equal(workflowRunIdOf(REPO, 'https://ci.example.com/actions/runs/1'), null);
    assert.equal(workflowRunIdOf(REPO, `${RUNS}/abc`), null);
    assert.equal(workflowRunIdOf(REPO, null), null);
  });
});
