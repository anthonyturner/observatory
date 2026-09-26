import { ProjectCounts, ProjectSnapshot } from './project.types';
import { compareProjects, severityOf, severitySummary } from './severity';

const NONE: ProjectCounts = {
  conflicted: 0,
  failing: 0,
  unknown: 0,
  unlinked: 0,
  unreviewed: 0,
  unclaimed: 0,
};

function project(
  name: string,
  counts: Partial<ProjectCounts> = {},
  extra: Partial<ProjectSnapshot> = {},
): ProjectSnapshot {
  return {
    name,
    repo: `me/${name}`,
    dashboardUrl: `/p/me/${name}`,
    open: 0,
    counts: { ...NONE, ...counts },
    ...extra,
  };
}

describe('severity', () => {
  it('takes the worst problem, not the average', () => {
    expect(severityOf(project('a', { failing: 1, unreviewed: 9 })).id).toBe('blocked');
    expect(severityOf(project('b', { unknown: 1, unlinked: 3 })).id).toBe('unsettled');
    expect(severityOf(project('c', { unlinked: 1 })).id).toBe('untracked');
    expect(severityOf(project('d', { unreviewed: 1 })).id).toBe('waiting');
    expect(severityOf(project('e')).id).toBe('clear');
  });

  it('never calls an unreadable project healthy', () => {
    expect(severityOf(project('x', {}, { error: 'rate limited' })).id).toBe('unreadable');
  });

  it('orders by severity, then stuck, then open, then name', () => {
    const ordered = [
      project('clear'),
      project('waiting', { unreviewed: 1 }),
      project('unreadable', {}, { error: 'down' }),
      project('blocked-few', { failing: 1 }),
      project('blocked-many', { conflicted: 2, failing: 1 }),
      project('b-open', { unlinked: 1 }, { open: 5 }),
      project('a-open', { unlinked: 1 }, { open: 5 }),
    ]
      .sort(compareProjects)
      .map((p) => p.name);

    expect(ordered).toEqual([
      'blocked-many',
      'blocked-few',
      'unreadable',
      'a-open',
      'b-open',
      'waiting',
      'clear',
    ]);
  });

  it('sums projects up by severity, worst first', () => {
    const summary = severitySummary([project('a'), project('b', { failing: 1 }), project('c')]);

    expect(summary).toBe('1 blocked · 2 clear');
  });
});
