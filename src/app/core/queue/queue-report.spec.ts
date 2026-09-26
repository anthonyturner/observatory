import { parseQueueReport } from './queue-report';

const item = {
  number: 12,
  title: 'Split the pages',
  url: 'https://github.com/me/a/pull/12',
  isDraft: true,
  bucket: 'conflicted',
  closes: [3],
  failingChecks: 0,
  additions: 40,
  deletions: 2,
  idleDays: 4,
  ageDays: 9,
};

describe('parseQueueReport', () => {
  it('keeps every well-formed item', () => {
    const report = parseQueueReport({ generatedAt: 'x', repo: 'me/a', items: [item] });

    expect(report?.items).toEqual([item]);
  });

  it('drops items with an unknown state or a link that is not GitHub', () => {
    const report = parseQueueReport({
      generatedAt: 'x',
      repo: 'me/a',
      items: [{ ...item, bucket: 'fresh' }, { ...item, url: 'javascript:alert(1)' }, item],
    });

    expect(report?.items.length).toBe(1);
  });

  it('reads a missing size as unknown rather than zero', () => {
    const report = parseQueueReport({
      generatedAt: 'x',
      repo: 'me/a',
      items: [{ ...item, additions: undefined, deletions: null }],
    });

    expect(report?.items[0].additions).toBeNull();
    expect(report?.items[0].deletions).toBeNull();
  });

  it('refuses something that is not a queue report', () => {
    expect(parseQueueReport({ error: 'repo must be a GitHub owner/name' })).toBeNull();
  });
});
