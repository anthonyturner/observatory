import { parseProjectsReport } from './projects-report';

const counts = { conflicted: 1, failing: 0, unknown: 0, unlinked: 2, unreviewed: 0, unclaimed: 3 };
const project = {
  name: 'alpha',
  repo: 'me/alpha',
  dashboardUrl: '/p/me/alpha',
  open: 3,
  counts,
  issues: 4,
  oldestIdleDays: 2,
};

describe('parseProjectsReport', () => {
  it('keeps every well-formed project', () => {
    const report = parseProjectsReport({
      generatedAt: '2026-09-26T12:00:00Z',
      projects: [project],
    });

    expect(report?.projects).toEqual([project]);
  });

  it('keeps an unreadable project’s reason', () => {
    const unreadable = { ...project, error: 'rate limited', issues: undefined };

    expect(
      parseProjectsReport({ generatedAt: 'x', projects: [unreadable] })?.projects[0].error,
    ).toBe('rate limited');
  });

  it('drops a project with a malformed count rather than guessing', () => {
    const broken = { ...project, counts: { ...counts, failing: -1 } };

    expect(
      parseProjectsReport({ generatedAt: 'x', projects: [broken, project] })?.projects,
    ).toEqual([project]);
  });

  it('refuses something that is not a projects report', () => {
    expect(parseProjectsReport({ error: 'not found' })).toBeNull();
  });
});
