import { ACTIONS_NOW, actionsRun } from '../../../core/actions/testing/actions-fixture';
import { RunJob } from '../../../core/actions/run-jobs';
import { durationWords, eventWords } from '../actions-words';
import { runRows } from '../run-list/run-list';
import { firstPick, jobViews, runDetailOf } from './run-detail-view';

const JOB_URL = 'https://github.com/me/app/actions/runs/7/job/5';

const job = (id: number, more: Partial<RunJob> = {}): RunJob => ({
  id,
  name: `job ${id}`,
  outcome: 'passed',
  durationS: 65,
  url: JOB_URL,
  steps: [],
  ...more,
});

describe('firstPick', () => {
  it('opens on the newest failure, else the newest run, else nothing', () => {
    expect(firstPick([actionsRun(3, 1), actionsRun(2, 5, { outcome: 'failed' })])).toBe('2');
    expect(firstPick([actionsRun(3, 1), actionsRun(2, 5)])).toBe('3');
    expect(firstPick([])).toBeNull();
  });
});

describe('runDetailOf', () => {
  it('lists a run’s facts, links its workflow, and says whether it has failed jobs', () => {
    const run = actionsRun(41, 90, { outcome: 'failed', attempt: 2, event: 'pull_request' });
    const detail = runDetailOf(
      run,
      [
        {
          id: 9,
          name: 'CI',
          isActive: true,
          url: 'https://github.com/me/app/actions/workflows/ci.yml',
        },
      ],
      ACTIONS_NOW,
    );

    expect(detail.kind).toBe('CI · run 41');
    expect(detail.hasFailedJobs).toBe(true);
    expect(detail.workflowUrl).toBe('https://github.com/me/app/actions/workflows/ci.yml');
    expect(detail.facts.map((fact) => fact.label)).toEqual([
      'Branch',
      'Trigger',
      'Started by',
      'Started',
      'Took',
      'Attempt',
    ]);
    expect(detail.facts[1].value).toBe('pull request');
    expect(runDetailOf(actionsRun(1, 1), [], ACTIONS_NOW).workflowUrl).toBeNull();
  });
});

describe('jobViews', () => {
  it('lists each failed job’s failed steps, linked, and tags a job known to be flaky', () => {
    const [failed, passed] = jobViews(
      [
        job(5, {
          name: 'test',
          outcome: 'failed',
          steps: [
            { number: 2, name: 'Install', outcome: 'passed', url: `${JOB_URL}#step:2:1` },
            { number: 3, name: 'Test', outcome: 'failed', url: `${JOB_URL}#step:3:1` },
          ],
        }),
        job(6),
      ],
      ['test'],
    );

    expect(failed.failedSteps).toEqual([
      { key: '5-3', label: 'Step 3 · Test', url: `${JOB_URL}#step:3:1` },
    ]);
    expect(failed.isFlaky).toBe(true);
    expect(failed.note).toBeNull();
    expect(passed.failedSteps).toEqual([]);
    expect(passed.took).toBe('1m 5s');
  });

  it('says so when a job failed with no failed step', () => {
    expect(jobViews([job(5, { outcome: 'failed' })], [])[0].note).toContain('No step failed');
  });
});

describe('words', () => {
  it('says durations shortly and events as words', () => {
    expect(durationWords(48)).toBe('48s');
    expect(durationWords(180)).toBe('3m');
    expect(durationWords(3840)).toBe('1h 4m');
    expect(eventWords('workflow_dispatch')).toBe('workflow dispatch');
  });

  it('lists runs as rows, saying a run still going is running', () => {
    const [row] = runRows(
      [actionsRun(41, 5, { outcome: 'running', durationS: null, isFlaky: true })],
      ACTIONS_NOW,
    );

    expect(row).toEqual({
      key: '41',
      title: 'Change 41',
      workflow: 'CI #41',
      outcome: 'Running',
      colour: 'var(--actions-running)',
      isFlaky: true,
      meta: 'main · push by me',
      took: 'running',
      when: '5m ago',
    });
  });
});
