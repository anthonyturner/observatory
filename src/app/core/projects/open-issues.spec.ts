import { ProjectSnapshot } from './project.types';
import { knownOpenIssues } from './open-issues';

const COUNTS = { conflicted: 0, failing: 0, unknown: 0, unlinked: 0, unreviewed: 0, unclaimed: 0 };
const project = (overrides: Partial<ProjectSnapshot>): ProjectSnapshot => ({
  name: 'p',
  repo: 'o/p',
  dashboardUrl: '',
  open: 0,
  counts: COUNTS,
  ...overrides,
});

describe('knownOpenIssues', () => {
  it('adds the issues of every project GitHub could read', () => {
    expect(
      knownOpenIssues([
        project({ issues: 3 }),
        project({ issues: 4 }),
        project({ issues: 9, error: 'x' }),
      ]),
    ).toBe(7);
  });

  it('is unknown, not zero, when no project could be read', () => {
    expect(knownOpenIssues([])).toBeNull();
    expect(knownOpenIssues([project({ error: 'x' })])).toBeNull();
  });
});
