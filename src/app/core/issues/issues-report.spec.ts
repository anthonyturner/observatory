import { parseIssuesReport } from './issues-report';

const row = (number: number, extra: Record<string, unknown> = {}) => ({
  number,
  title: `Issue ${number}`,
  url: `https://github.com/me/a/issues/${number}`,
  labels: [{ name: 'bug', color: 'd73a4a' }, { name: 7 }],
  assignees: ['ann', 3],
  author: 'me',
  createdAt: '2026-09-01T12:00:00Z',
  updatedAt: '2026-09-20T12:00:00Z',
  closedAt: null,
  comet: true,
  prs: [4, 'x'],
  ...extra,
});

describe('parseIssuesReport', () => {
  it("reads pr-starmap's issues/current shape, leaving out what does not parse", () => {
    const report = parseIssuesReport({
      generatedAt: '2026-09-26T12:00:00Z',
      repo: 'me/a',
      days: 60,
      total: { open: 91, closed: 12, comets: 70 },
      open: [row(1), row(2, { url: 'https://evil.example/2' }), 'nope'],
      closed: [row(3, { closedAt: '2026-09-25T00:00:00Z', stateReason: 'NOT_PLANNED' })],
    });

    expect(report?.total).toEqual({ open: 91, closed: 12, comets: 70 });
    expect(report?.open.map((issue) => issue.number)).toEqual([1]);
    expect(report?.open[0].labels).toEqual([{ name: 'bug', color: 'd73a4a' }]);
    expect(report?.open[0].assignees).toEqual(['ann']);
    expect(report?.open[0].prs).toEqual([4]);
    expect(report?.closed[0].stateReason).toBe('NOT_PLANNED');
    expect(report?.closed[0].closedAt).toBe('2026-09-25T00:00:00Z');
  });

  it('counts the lists when the totals are missing', () => {
    const report = parseIssuesReport({
      generatedAt: '2026-09-26T12:00:00Z',
      repo: 'me/a',
      open: [row(1), row(2, { comet: false })],
      closed: [],
    });

    expect(report?.total).toEqual({ open: 2, closed: 0, comets: 1 });
    expect(report?.days).toBe(60);
  });

  it('refuses a report without its lists', () => {
    expect(parseIssuesReport({ generatedAt: '2026-09-26T12:00:00Z', repo: 'me/a' })).toBeNull();
    expect(parseIssuesReport(null)).toBeNull();
  });
});
