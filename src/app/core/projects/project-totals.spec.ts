import { totalsOf } from './project-totals';
import { ProjectSnapshot } from './project.types';

const base: ProjectSnapshot = {
  name: 'a',
  repo: 'me/a',
  dashboardUrl: '/p/me/a',
  open: 1,
  counts: { conflicted: 0, failing: 0, unknown: 0, unlinked: 0, unreviewed: 0, unclaimed: 0 },
};

describe('totalsOf', () => {
  it('names open PRs, issues and the oldest idle one', () => {
    expect(totalsOf({ ...base, issues: 3, oldestIdleDays: 12 })).toEqual([
      '1 open PR',
      '3 issues',
      'oldest untouched 12 d',
    ]);
  });

  it('leaves out what it does not know, and idleness with nothing open', () => {
    expect(totalsOf({ ...base, open: 0, oldestIdleDays: 12 })).toEqual(['0 open PRs']);
  });
});
