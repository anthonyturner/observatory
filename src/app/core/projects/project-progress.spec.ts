import { progressBetween } from './project-progress';
import { ProjectSnapshot } from './project.types';

const COUNTS = { conflicted: 0, failing: 0, unknown: 0, unlinked: 0, unreviewed: 0, unclaimed: 0 };
const project = (repo: string, open: number, issues?: number, error?: string): ProjectSnapshot => ({
  name: repo,
  repo,
  dashboardUrl: '',
  open,
  issues,
  counts: COUNTS,
  ...(error ? { error } : {}),
});

describe('progressBetween', () => {
  it('finds closed issues and finished pull requests', () => {
    expect(progressBetween([project('a', 5, 10)], [project('a', 3, 7)])).toEqual([
      { key: 'a', closedIssues: 3, finishedPulls: 2 },
    ]);
  });

  it('ignores projects that only grew or stayed the same', () => {
    expect(
      progressBetween(
        [project('a', 5, 10), project('b', 1, 1)],
        [project('a', 6, 12), project('b', 1, 1)],
      ),
    ).toEqual([]);
  });

  it('ignores projects that were not read in either report, or are new', () => {
    expect(progressBetween([project('a', 5, 10, 'rate limit')], [project('a', 1, 1)])).toEqual([]);
    expect(progressBetween([project('a', 5, 10)], [project('a', 1, 1, 'rate limit')])).toEqual([]);
    expect(progressBetween([], [project('new', 1, 1)])).toEqual([]);
  });

  it('does not count an issue count that went missing as closures', () => {
    expect(progressBetween([project('a', 5, 10)], [project('a', 5)])).toEqual([]);
  });
});
