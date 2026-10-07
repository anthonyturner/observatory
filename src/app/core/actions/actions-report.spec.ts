import { parseActionsReport, parseCiHealth } from './actions-report';
import { parseRunJobs } from './run-jobs';

const RUN = {
  id: 18234567890,
  workflowId: 9,
  workflow: 'CI',
  title: 'Add a thing',
  number: 41,
  attempt: 2,
  event: 'push',
  branch: 'main',
  sha: 'a'.repeat(40),
  actor: 'me',
  createdAt: '2026-10-07T10:00:00Z',
  startedAt: '2026-10-07T10:00:30Z',
  durationS: 150,
  outcome: 'failed',
  isFlaky: true,
  url: 'https://github.com/me/app/actions/runs/18234567890',
};

const REPORT = {
  generatedAt: '2026-10-07T11:00:00Z',
  repo: 'me/app',
  workflows: [
    {
      id: 9,
      name: 'CI',
      path: '.github/workflows/ci.yml',
      isActive: true,
      url: 'https://github.com/me/app/actions/workflows/ci.yml',
    },
  ],
  runs: [
    RUN,
    { ...RUN, id: 2, outcome: 'exploded' },
    { ...RUN, id: 3, url: 'javascript:alert(1)' },
  ],
  flakyChecks: ['test'],
  health: { repo: 'me/app', branch: 'main', state: 'failing', failing: ['CI'] },
};

describe('parseActionsReport', () => {
  it('reads the runs it can trust, with times in milliseconds', () => {
    const report = parseActionsReport(REPORT);

    expect(report?.runs.map((run) => run.id)).toEqual([18234567890]);
    expect(report?.runs[0].startedAt).toBe(Date.parse('2026-10-07T10:00:30Z'));
    expect(report?.runs[0].isFlaky).toBe(true);
    expect(report?.workflows[0].name).toBe('CI');
    expect(report?.health.state).toBe('failing');
    expect(report?.flakyChecks).toEqual(['test']);
  });

  it('is null for an answer that is not a report', () => {
    expect(parseActionsReport({ repo: 'me/app' })).toBeNull();
    expect(parseActionsReport('nope')).toBeNull();
    expect(parseCiHealth({ repo: 'me/app', state: 'on fire' })).toBeNull();
  });
});

describe('parseRunJobs', () => {
  it('reads each job and its steps, dropping a link that is not to GitHub', () => {
    const jobs = parseRunJobs({
      repo: 'me/app',
      runId: 7,
      jobs: [
        {
          id: 5,
          name: 'build',
          outcome: 'failed',
          durationS: 65,
          url: 'https://github.com/me/app/actions/runs/7/job/5',
          steps: [
            {
              number: 3,
              name: 'Test',
              outcome: 'failed',
              url: 'https://github.com/me/app/actions/runs/7/job/5#step:3:1',
            },
            { number: 4, name: 'Bad', outcome: 'failed', url: 'https://elsewhere.example/x' },
          ],
        },
      ],
    });

    expect(jobs?.runId).toBe(7);
    expect(jobs?.jobs[0].steps.map((step) => step.number)).toEqual([3]);
    expect(parseRunJobs({ jobs: [] })).toBeNull();
  });
});
