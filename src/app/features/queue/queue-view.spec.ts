import { QueueItem } from '../../core/queue/queue-report';
import {
  hiddenCount,
  hiddenNote,
  isQuickWin,
  queueLegend,
  queueSections,
  queueStamp,
  visibleItems,
} from './queue-view';

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
  isSeen: false,
  hidden: null,
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

describe('triage in the list', () => {
  const snoozed = item(5, { hidden: { reason: 'snoozed', until: '2026-09-30T12:00:00Z' } });
  const dismissed = item(6, { hidden: { reason: 'dismissed' } });

  it('puts a seen, waiting pull request in Seen recently, after the rest', () => {
    const sections = queueSections([item(1, { isSeen: true }), item(2)], null);

    expect(sections.map((section) => section.meaning)).toEqual(['Waiting on you', 'Seen recently']);
  });

  it('leaves a seen pull request that is blocked where it is', () => {
    const sections = queueSections([item(1, { bucket: 'conflicted', isSeen: true })], null);

    expect(sections.map((section) => section.bucket)).toEqual(['conflicted']);
  });

  it('hides snoozed and dismissed ones unless asked, and counts them', () => {
    const all = [item(1), snoozed, dismissed];

    expect(visibleItems(all, false).map((each) => each.number)).toEqual([1]);
    expect(visibleItems(all, true).length).toBe(3);
    expect(hiddenCount(all)).toBe(2);
  });

  it('says why a row is hidden', () => {
    expect(hiddenNote(snoozed, 'en-US')).toBe('snoozed until Sep 30');
    expect(hiddenNote(dismissed)).toBe('dismissed until it changes');
    expect(hiddenNote(item(1))).toBeNull();
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
      ['fresh', 0],
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
