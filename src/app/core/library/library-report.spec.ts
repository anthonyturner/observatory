import { parseLibraryReport } from './library-report';

const PAGE = {
  slug: 'Home',
  title: 'Home',
  shelf: 'Wiki',
  url: 'https://github.com/me/app/wiki/Home',
  markdown: 'Hi',
};
const REPORT = {
  generatedAt: '2026-10-07T00:00:00Z',
  repo: 'me/app',
  source: 'wiki',
  url: 'https://github.com/me/app/wiki',
  pages: [PAGE],
  isTruncated: false,
};

describe('parseLibraryReport', () => {
  it('reads a report', () => {
    expect(parseLibraryReport(REPORT)).toEqual({
      ...REPORT,
      generatedAt: Date.parse(REPORT.generatedAt),
    });
  });

  it('drops a page it cannot trust, and refuses an answer that is not a report', () => {
    const odd = { ...PAGE, url: 'javascript:alert(1)' };

    expect(parseLibraryReport({ ...REPORT, pages: [odd, 'x'] })?.pages).toEqual([]);
    expect(parseLibraryReport({ ...REPORT, source: 'blog' })).toBeNull();
    expect(parseLibraryReport('not json')).toBeNull();
  });
});
