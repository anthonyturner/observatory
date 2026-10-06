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
  branch: 'feat/12',
  base: 'main',
  mergeable: 'CONFLICTING',
  changedFiles: 4,
  isSeen: true,
  hidden: null,
  lookedSha: null,
  sinceLook: null,
};

describe('parseQueueReport', () => {
  it('reads a missing branch as empty and mergeability as unknown, never as fine', () => {
    const { branch, mergeable, changedFiles, ...bare } = item;
    void [branch, mergeable, changedFiles];
    const report = parseQueueReport({ generatedAt: 'x', repo: 'me/a', items: [bare] });

    expect(report?.items[0]).toEqual({
      ...item,
      branch: '',
      base: 'main',
      mergeable: 'UNKNOWN',
      changedFiles: null,
    });
  });

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

  it('reads triage defensively: a malformed hidden is none, and seen must be true', () => {
    const report = parseQueueReport({
      generatedAt: 'x',
      repo: 'me/a',
      items: [
        { ...item, isSeen: 'yes', hidden: { reason: 'snoozed' } },
        { ...item, hidden: { reason: 'snoozed', until: '2026-10-01T00:00:00Z' } },
      ],
    });

    expect(report?.items.map((each) => [each.isSeen, each.hidden])).toEqual([
      [false, null],
      [true, { reason: 'snoozed', until: '2026-10-01T00:00:00Z' }],
    ]);
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
  it('reads the head last looked at and what changed since, else none', () => {
    const report = parseQueueReport({
      generatedAt: 'x',
      repo: 'me/a',
      items: [
        { ...item, lookedSha: 'a'.repeat(40), sinceLook: { newCommits: 2 } },
        { ...item, lookedSha: 7, sinceLook: 'lots' },
      ],
    });

    expect(report?.items.map((each) => [each.lookedSha, each.sinceLook])).toEqual([
      ['a'.repeat(40), { newCommits: 2 }],
      [null, null],
    ]);
  });
});
