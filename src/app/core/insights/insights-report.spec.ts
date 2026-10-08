import { isCounting, parseInsightsReport } from './insights-report';

const BODY = {
  generatedAt: '2026-10-08T12:00:00Z',
  repo: 'me/a',
  weeks: 12,
  commits: {
    status: 'read',
    note: null,
    weeks: [
      { weekStart: '2026-10-04T00:00:00Z', total: 5, days: [1, 1, 1, 1, 1, 0, 0] },
      { weekStart: '2026-10-11T00:00:00Z', total: 2, days: [2] },
    ],
  },
  contributors: {
    status: 'counting',
    note: 'GitHub is still counting the contributors.',
    people: [{ login: 'me', isBot: false, commits: 4 }, { commits: 9 }],
  },
  pulls: {
    status: 'read',
    note: null,
    finished: [
      {
        number: 7,
        openedAt: '2026-10-06T10:00:00Z',
        finishedAt: '2026-10-07T10:00:00Z',
        fate: 'merged',
      },
    ],
  },
  traffic: { status: 'nonsense', views: { count: 3, uniques: 1, days: [{ count: 2 }] } },
};

describe('parseInsightsReport', () => {
  it('keeps each part it can check and drops what it cannot', () => {
    const report = parseInsightsReport(BODY);

    expect(report?.generatedAt).toBe(Date.parse('2026-10-08T12:00:00Z'));
    expect(report?.commits.weeks.map((week) => week.total)).toEqual([5]);
    expect(report?.contributors.people).toEqual([
      { login: 'me', isBot: false, commits: 4, additions: 0, deletions: 0 },
    ]);
    expect(report?.pulls.finished.map((each) => each.number)).toEqual([7]);
    expect(report?.traffic.status).toBe('failed');
    expect(report?.traffic.views).toEqual({ count: 3, uniques: 1, days: [] });
    expect(report?.traffic.clones).toBeNull();
    expect(report && isCounting(report)).toBe(true);
  });

  it('reads anything but a report as none', () => {
    expect(parseInsightsReport({ repo: 'me/a' })).toBeNull();
    expect(parseInsightsReport('nope')).toBeNull();
  });
});
