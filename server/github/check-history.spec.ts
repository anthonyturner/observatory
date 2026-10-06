import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { attemptsOf, readCheckHistory, rerunIdsOf } from './check-history.ts';

const SHA = 'a'.repeat(40);

const job = (name: string, conclusion: string | null, completedAt: string | null) => ({
  id: 1,
  name,
  head_sha: SHA,
  run_attempt: 1,
  conclusion,
  completed_at: completedAt,
});

describe('rerunIdsOf', () => {
  it('keeps only the workflow runs that were run more than once', () => {
    const ids = rerunIdsOf({
      workflow_runs: [
        { id: 11, run_attempt: 1 },
        { id: 12, run_attempt: 2 },
        { id: 13, run_attempt: 3 },
        { id: 'x', run_attempt: 2 },
      ],
    });

    assert.deepEqual(ids, [12, 13]);
  });

  it('reads anything else as no runs', () => {
    assert.deepEqual(rerunIdsOf(null), []);
    assert.deepEqual(rerunIdsOf({ workflow_runs: 'none' }), []);
  });
});

describe('attemptsOf', () => {
  it('keeps the finished jobs, with their conclusion in upper case', () => {
    const attempts = attemptsOf({
      jobs: [
        job('e2e', 'failure', '2026-10-01T10:00:00Z'),
        job('e2e', 'success', '2026-10-01T10:20:00Z'),
        job('build', null, null),
      ],
    });

    assert.deepEqual(attempts, [
      { name: 'e2e', sha: SHA, conclusion: 'FAILURE', completedAt: '2026-10-01T10:00:00Z' },
      { name: 'e2e', sha: SHA, conclusion: 'SUCCESS', completedAt: '2026-10-01T10:20:00Z' },
    ]);
  });
});

describe('readCheckHistory', () => {
  it('reads the jobs of every attempt of each rerun workflow run', async () => {
    const asked: string[] = [];
    const answers: Record<string, unknown> = {
      'repos/me/app/actions/runs?per_page=100': {
        workflow_runs: [
          { id: 7, run_attempt: 2 },
          { id: 8, run_attempt: 1 },
        ],
      },
      'repos/me/app/actions/runs/7/jobs?filter=all&per_page=100': {
        jobs: [job('e2e', 'failure', '2026-10-01T10:00:00Z')],
      },
    };

    const attempts = await readCheckHistory(async (path) => {
      asked.push(path);
      return answers[path];
    }, 'me/app');

    assert.deepEqual(asked, [
      'repos/me/app/actions/runs?per_page=100',
      'repos/me/app/actions/runs/7/jobs?filter=all&per_page=100',
    ]);
    assert.deepEqual(attempts, [
      { name: 'e2e', sha: SHA, conclusion: 'FAILURE', completedAt: '2026-10-01T10:00:00Z' },
    ]);
  });
});
