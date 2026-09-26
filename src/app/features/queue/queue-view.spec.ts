import { QueueItem } from '../../core/queue/queue-report';
import { isQuickWin, queueLegend, queueSections, queueStamp } from './queue-view';

const item = (number: number, overrides: Partial<QueueItem> = {}): QueueItem => ({
  number,
  title: `Change ${number}`,
  url: `https://github.com/me/a/pull/${number}`,
  isDraft: false,
  bucket: 'unreviewed',
  closes: [100 + number],
  failingChecks: 0,
  additions: 20,
  deletions: 5,
  idleDays: number,
  ageDays: 10,
  ...overrides,
});

const items = [
  item(1, { bucket: 'conflicted', closes: [] }),
  item(2),
  item(3, { additions: 900 }),
  item(4, { bucket: 'unknown', additions: null, deletions: null }),
];

describe('queueSections', () => {
  it('groups by bucket, most urgent first, with what each row says', () => {
    const sections = queueSections(items, null);

    expect(sections.map((section) => section.meaning)).toEqual([
      'Cannot merge',
      'Mergeability unknown',
      'Waiting on you',
    ]);
    expect(sections[0].rows[0].detail).toBe('closes nothing · idle 1d · +20 −5');
    expect(sections[1].rows[0].detail).toBe('closes #104 · idle 4d · size unknown');
  });

  it('narrows to one bucket, or to quick wins', () => {
    expect(queueSections(items, 'unknown').map((section) => section.bucket)).toEqual(['unknown']);
    expect(
      queueSections(items, 'quick').flatMap((section) => section.rows.map((row) => row.number)),
    ).toEqual([2]);
  });
});

describe('isQuickWin', () => {
  it('is a small pull request waiting on you, of known size', () => {
    expect(isQuickWin(item(1))).toBe(true);
    expect(isQuickWin(item(1, { additions: 300 }))).toBe(false);
    expect(isQuickWin(item(1, { bucket: 'failing' }))).toBe(false);
    expect(isQuickWin(item(1, { additions: null }))).toBe(false);
  });
});

describe('queueLegend', () => {
  it('counts each bucket and the quick wins', () => {
    expect(queueLegend(items).map((entry) => [entry.filter, entry.count])).toEqual([
      ['conflicted', 1],
      ['failing', 0],
      ['unknown', 1],
      ['unlinked', 0],
      ['unreviewed', 2],
      ['quick', 1],
    ]);
  });
});

describe('queueStamp', () => {
  const now = new Date(2026, 8, 26, 15, 0).getTime();

  it('names the repository, what is open and when it was read', () => {
    const state = {
      status: 'ready',
      report: { generatedAt: new Date(2026, 8, 26, 9, 42).toISOString(), repo: 'me/a', items },
    } as const;

    expect(queueStamp(state, now)).toBe('me/a · 4 open · refreshed 09:42');
  });

  it('says it is reading, out of reach, or why it was refused', () => {
    expect(queueStamp({ status: 'reading' }, now)).toBe('reading the queue');
    expect(queueStamp({ status: 'unreachable' }, now)).toBe('API out of reach');
    expect(queueStamp({ status: 'refused', reason: 'repo must be a GitHub owner/name' }, now)).toBe(
      'repo must be a GitHub owner/name',
    );
  });
});
