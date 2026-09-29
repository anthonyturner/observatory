import { parseNewsReport } from './news-parse';

const item = {
  title: 'Claude Code 3',
  url: 'https://blog.example/cc3',
  source: 'Blog',
  publishedAt: '2026-09-28T09:00:00Z',
  tool: true,
};

describe('parseNewsReport', () => {
  it('reads both sections and the feeds it could not read', () => {
    const report = parseNewsReport({
      ai: [item],
      engineering: [{ ...item, url: 'https://eng.example/x', tool: false, publishedAt: null }],
      unread: ['Down'],
      readAt: '2026-09-28T12:00:00Z',
    });

    expect(report?.ai).toEqual([item]);
    expect(report?.engineering[0]).toEqual(
      expect.objectContaining({ publishedAt: null, tool: false }),
    );
    expect(report?.unread).toEqual(['Down']);
  });

  it('drops a headline without a web link rather than trusting it', () => {
    const report = parseNewsReport({
      ai: [item, { ...item, url: 'javascript:alert(1)' }, { ...item, title: '' }],
      engineering: [],
    });

    expect(report?.ai.length).toBe(1);
  });

  it('is null for anything that is not a news report', () => {
    expect(parseNewsReport(null)).toBeNull();
    expect(parseNewsReport({ ai: [] })).toBeNull();
  });
});
