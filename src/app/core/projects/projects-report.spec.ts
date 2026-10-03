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

  it('keeps well-formed directives and drops the rest', () => {
    const directive = {
      project: 'alpha',
      number: 7,
      title: 'Fix it',
      url: 'https://github.com/me/alpha/pull/7',
      bucket: 'failing',
    };

    const report = parseProjectsReport({
      generatedAt: 'x',
      projects: [],
      directives: [
        directive,
        { ...directive, bucket: 'fresh' },
        { ...directive, url: 'javascript:alert(1)' },
      ],
    });

    expect(report?.directives).toEqual([directive]);
  });

  it('reads a report without directives as having none', () => {
    expect(parseProjectsReport({ generatedAt: 'x', projects: [] })?.directives).toEqual([]);
  });

  it('keeps the numbers of the open pull requests and issues', () => {
    const listed = {
      ...project,
      openPulls: [
        { number: 12, bucket: 'failing' },
        { number: 9, bucket: 'unreviewed' },
      ],
      openIssues: [40, 31],
    };

    const parsed = parseProjectsReport({ generatedAt: 'x', projects: [listed] })?.projects[0];

    expect(parsed?.openPulls).toEqual([12, 9]);
    expect(parsed?.openIssues).toEqual([40, 31]);
  });

  it('leaves out a null or malformed list, which is unknown rather than empty', () => {
    const unknown = {
      ...project,
      openPulls: [{ number: 12, bucket: 'failing' }, { number: -1 }],
      openIssues: null,
    };

    const parsed = parseProjectsReport({ generatedAt: 'x', projects: [unknown] })?.projects[0];

    expect(parsed).toEqual(project);
  });

  it('refuses something that is not a projects report', () => {
    expect(parseProjectsReport({ error: 'not found' })).toBeNull();
  });
});
