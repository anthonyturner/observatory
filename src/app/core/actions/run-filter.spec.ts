import { actionsRun } from './testing/actions-fixture';
import { NO_FILTER, filterChoices, filterRuns, isFiltered } from './run-filter';

const RUNS = [
  actionsRun(4, 5, { branch: 'feat/x', outcome: 'running', durationS: null }),
  actionsRun(3, 30, { workflow: 'Deploy', outcome: 'failed' }),
  actionsRun(2, 60, { branch: 'feat/x' }),
  actionsRun(1, 90, { branch: '' }),
];

describe('filterChoices', () => {
  it('offers only what some run has: workflows A to Z, branches newest first, failed first', () => {
    expect(filterChoices(RUNS)).toEqual({
      workflows: ['CI', 'Deploy'],
      branches: ['feat/x', 'main'],
      outcomes: ['failed', 'running', 'passed'],
    });
  });
});

describe('filterRuns', () => {
  it('lets every run through with no filter', () => {
    expect(filterRuns(RUNS, NO_FILTER).length).toBe(4);
    expect(isFiltered(NO_FILTER)).toBe(false);
  });

  it('keeps the runs that pass every field set, in order', () => {
    const filter = { workflow: 'CI', branch: 'feat/x', outcome: null };

    expect(filterRuns(RUNS, filter).map((run) => run.id)).toEqual([4, 2]);
    expect(filterRuns(RUNS, { ...filter, outcome: 'passed' }).map((run) => run.id)).toEqual([2]);
    expect(isFiltered(filter)).toBe(true);
  });
});
