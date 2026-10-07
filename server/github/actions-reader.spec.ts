import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  defaultBranchOf,
  readRunJobs,
  readWorkflowRuns,
  runJobsOf,
  workflowRunsOf,
  workflowsOf,
} from './actions-reader.ts';

const run = (id: number, extra: object = {}) => ({
  id,
  name: 'CI',
  display_title: 'Add a thing',
  run_number: 40 + id,
  run_attempt: 1,
  event: 'push',
  status: 'completed',
  conclusion: 'success',
  workflow_id: 9,
  head_branch: 'main',
  head_sha: 'a'.repeat(40),
  html_url: `https://github.com/me/app/actions/runs/${id}`,
  created_at: '2026-10-07T10:00:00Z',
  updated_at: '2026-10-07T10:03:00Z',
  run_started_at: '2026-10-07T10:00:30Z',
  actor: { login: 'me' },
  ...extra,
});

describe('workflowRunsOf', () => {
  it('reads each run, and leaves out one missing what the screen needs', () => {
    const runs = workflowRunsOf({
      workflow_runs: [
        run(1),
        run(2, { conclusion: null, status: 'in_progress' }),
        run(3, { id: 'x' }),
      ],
    });

    assert.deepEqual(
      runs.map((each) => [each.id, each.status, each.conclusion]),
      [
        [1, 'completed', 'success'],
        [2, 'in_progress', null],
      ],
    );
    assert.equal(runs[0].startedAt, '2026-10-07T10:00:30Z');
    assert.equal(runs[0].actor, 'me');
    assert.equal(runs[0].workflowName, 'CI');
  });

  it('starts a run when it was made when GitHub gives no start, and reads anything else as none', () => {
    assert.equal(
      workflowRunsOf({ workflow_runs: [run(1, { run_started_at: null })] })[0].startedAt,
      '2026-10-07T10:00:00Z',
    );
    assert.deepEqual(workflowRunsOf({ message: 'Not Found' }), []);
  });
});

describe('workflowsOf, runJobsOf and defaultBranchOf', () => {
  it('reads workflows with their state', () => {
    assert.deepEqual(
      workflowsOf({
        workflows: [
          { id: 9, name: 'CI', path: '.github/workflows/ci.yml', state: 'active' },
          { id: 10, name: 'Old', path: '.github/workflows/old.yml', state: 'disabled_manually' },
          { name: 'No id' },
        ],
      }),
      [
        { id: 9, name: 'CI', path: '.github/workflows/ci.yml', state: 'active' },
        { id: 10, name: 'Old', path: '.github/workflows/old.yml', state: 'disabled_manually' },
      ],
    );
  });

  it('reads a run’s jobs with their steps', () => {
    const [job] = runJobsOf({
      jobs: [
        {
          id: 5,
          name: 'build',
          status: 'completed',
          conclusion: 'failure',
          html_url: 'https://github.com/me/app/actions/runs/1/job/5',
          started_at: '2026-10-07T10:00:30Z',
          completed_at: '2026-10-07T10:02:00Z',
          steps: [
            { number: 1, name: 'Set up job', status: 'completed', conclusion: 'success' },
            { number: 2, name: 'Test', status: 'completed', conclusion: 'failure' },
            { name: 'No number' },
          ],
        },
      ],
    });

    assert.equal(job.conclusion, 'failure');
    assert.deepEqual(
      job.steps.map((step) => [step.number, step.conclusion]),
      [
        [1, 'success'],
        [2, 'failure'],
      ],
    );
  });

  it('reads the default branch, and main where GitHub says none', () => {
    assert.equal(defaultBranchOf({ default_branch: 'trunk' }), 'trunk');
    assert.equal(defaultBranchOf({}), 'main');
  });
});

describe('readWorkflowRuns and readRunJobs', () => {
  it('asks for a hundred runs, one branch’s when given, and a run’s jobs', async () => {
    const asked: string[] = [];
    const get = async (path: string) => {
      asked.push(path);
      return {};
    };

    await readWorkflowRuns(get, 'me/app');
    await readWorkflowRuns(get, 'me/app', 'feat/x y');
    await readRunJobs(get, 'me/app', 12345678901);

    assert.deepEqual(asked, [
      'repos/me/app/actions/runs?per_page=100&exclude_pull_requests=true',
      'repos/me/app/actions/runs?per_page=100&exclude_pull_requests=true&branch=feat%2Fx%20y',
      'repos/me/app/actions/runs/12345678901/jobs?per_page=100',
    ]);
  });
});
