import { parseJournalReport } from './journal-report';

const ENTRY = {
  pull: 555,
  url: 'https://github.com/me/app/pull/555#issuecomment-1',
  postedAt: '2026-10-08T12:00:00Z',
  firstVersion: 'One.',
  feedback: 'Two.',
  change: 'Three.',
  principles: ['deep-modules', 'design-it-twice'],
};
const REPORT = { generatedAt: '2026-10-08T13:00:00Z', repo: 'me/app', entries: [ENTRY] };

describe('parseJournalReport', () => {
  it('reads a report, with its times in milliseconds', () => {
    expect(parseJournalReport(REPORT)).toEqual({
      generatedAt: Date.parse(REPORT.generatedAt),
      repo: 'me/app',
      entries: [{ ...ENTRY, postedAt: Date.parse(ENTRY.postedAt) }],
    });
  });

  it('drops an entry it cannot trust and keeps the rest', () => {
    const odd = [
      { ...ENTRY, url: 'javascript:alert(1)' },
      { ...ENTRY, feedback: '' },
      { ...ENTRY, postedAt: 'yesterday' },
      'x',
    ];

    expect(parseJournalReport({ ...REPORT, entries: [...odd, ENTRY] })?.entries.length).toBe(1);
  });

  it('keeps an entry whose principle ids are odd, dropping only the odd ids', () => {
    const report = parseJournalReport({
      ...REPORT,
      entries: [{ ...ENTRY, principles: ['deep-modules', 3, ''] }],
    });

    expect(report?.entries[0].principles).toEqual(['deep-modules']);
  });

  it('refuses an answer that is not a report', () => {
    expect(parseJournalReport({ ...REPORT, repo: '' })).toBeNull();
    expect(parseJournalReport({ ...REPORT, generatedAt: 'x' })).toBeNull();
    expect(parseJournalReport('not json')).toBeNull();
  });
});
