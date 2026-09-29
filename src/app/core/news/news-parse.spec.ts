import { parseNewsReport } from './news-parse';

const item = {
  title: 'Claude Code 3',
  url: 'https://blog.example/cc3',
  source: 'Blog',
  publishedAt: '2026-09-28T09:00:00Z',
  summary: ['Claude Code 3 writes and runs its own tests.'],
  image: 'https://blog.example/cc3.png',
  video: { kind: 'embed', url: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ' },
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

  it('keeps only an https picture', () => {
    const report = parseNewsReport({
      ai: [
        { ...item, image: 'http://blog.example/cc3.png' },
        { ...item, image: 42 },
      ],
      engineering: [],
    });

    expect(report?.ai.map((each) => each.image)).toEqual([null, null]);
  });

  it('keeps only an https video of a known kind', () => {
    const report = parseNewsReport({
      ai: [
        { ...item, video: { kind: 'embed', url: 'http://www.youtube-nocookie.com/embed/x' } },
        { ...item, video: { kind: 'page', url: 'https://a.example/' } },
        { ...item, video: 'https://a.example/clip.mp4' },
      ],
      engineering: [],
    });

    expect(report?.ai.map((each) => each.video)).toEqual([null, null, null]);
  });

  it('is null for anything that is not a news report', () => {
    expect(parseNewsReport(null)).toBeNull();
    expect(parseNewsReport({ ai: [] })).toBeNull();
  });
});
