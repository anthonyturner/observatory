import { DoneItem } from '../../../core/queue/done-work';
import { QueueItem } from '../../../core/queue/queue-report';
import {
  fillSprint,
  mergedOf,
  reviewMinutes,
  sprintOptions,
  sprintRows,
  sprintSummary,
} from './sprint-plan';

const pull = (number: number, extra: Partial<QueueItem> = {}): QueueItem => ({
  number,
  title: `Change ${number}`,
  url: `https://github.com/me/a/pull/${number}`,
  isDraft: false,
  bucket: 'unreviewed',
  closes: [],
  failingChecks: 0,
  flakyChecks: [],
  additions: 50,
  deletions: 0,
  idleDays: 2,
  ageDays: 5,
  branch: `h${number}`,
  base: 'main',
  mergeable: 'MERGEABLE',
  changedFiles: 3,
  isSeen: false,
  hidden: null,
  lookedSha: null,
  sinceLook: null,
  ...extra,
});

const sky = (additions: number | null, deletions: number | null = 0) => ({
  pr: 1,
  title: 'x',
  bucket: 'unreviewed' as const,
  idleDays: 0,
  additions,
  deletions,
  issues: [],
});

describe('reviewMinutes', () => {
  it('budgets two minutes of setup, then 500 changed lines an hour', () => {
    expect(reviewMinutes(sky(0))).toBe(2);
    expect(reviewMinutes(sky(300, 200))).toBe(62);
    expect(reviewMinutes(sky(50))).toBe(8);
  });

  it('cannot size a pull request GitHub gave no line counts for', () => {
    expect(reviewMinutes(sky(null, null))).toBeNull();
  });
});

describe('fillSprint', () => {
  it('takes pull requests in queue order, blocked first, while they fit', () => {
    const picks = fillSprint([pull(1), pull(2, { bucket: 'failing' }), pull(3), pull(4)], 25, null);

    // 8 minutes each: three fit in 25, a fourth would not.
    expect(picks.map((p) => p.pr)).toEqual([2, 1, 3]);
    expect(picks[0]).toEqual({ pr: 2, title: 'Change 2', lines: 50, minutes: 8 });
  });

  it('passes over one too large for the time left and takes smaller ones after it', () => {
    const picks = fillSprint(
      [pull(1), pull(2, { additions: 1000 }), pull(3, { additions: 20, deletions: 5 })],
      15,
      null,
    );

    expect(picks.map((p) => p.pr)).toEqual([1, 3]);
  });

  it('leads with Next star’s pick when it fits', () => {
    const picks = fillSprint([pull(1), pull(2), pull(3)], 25, 3);

    expect(picks.map((p) => p.pr)).toEqual([3, 1, 2]);
  });

  it('skips drafts, snoozed and dismissed pull requests, and ones of unknown size', () => {
    const picks = fillSprint(
      [
        pull(1, { isDraft: true }),
        pull(2, { hidden: { reason: 'dismissed' } }),
        pull(3, { additions: null, deletions: null }),
        pull(4),
      ],
      45,
      null,
    );

    expect(picks.map((p) => p.pr)).toEqual([4]);
  });

  it('is empty when nothing fits', () => {
    expect(fillSprint([pull(1, { additions: 2000 })], 45, null)).toEqual([]);
  });
});

describe('sprintOptions', () => {
  it('fills 15, 25 and 45 minutes from the same queue', () => {
    const options = sprintOptions([pull(1), pull(2), pull(3), pull(4), pull(5)], null);

    expect(options.map((o) => [o.minutes, o.picks.length])).toEqual([
      [15, 1],
      [25, 3],
      [45, 5],
    ]);
  });
});

describe('sprintRows and sprintSummary', () => {
  const picks = fillSprint([pull(1), pull(2), pull(3)], 45, null);
  const done = (number: number, kind: DoneItem['kind']): DoneItem => ({
    key: `pr${number}`,
    kind,
    number,
    title: `Change ${number}`,
    at: 0,
    day: '2026-10-06',
  });

  it('marks merged over reviewed, and leaves the rest open', () => {
    const merged = mergedOf([done(1, 'merged'), done(3, 'closed')]);
    const rows = sprintRows(picks, new Set([1, 2]), merged);

    expect(rows.map((r) => [r.pr, r.mark])).toEqual([
      [1, 'merged'],
      [2, 'reviewed'],
      [3, 'open'],
    ]);
  });

  it('sums a finished sprint up as merged, reviewed and skipped', () => {
    const summary = sprintSummary(sprintRows(picks, new Set([2]), new Set([1])));

    expect(summary.merged.map((r) => r.pr)).toEqual([1]);
    expect(summary.reviewed.map((r) => r.pr)).toEqual([2]);
    expect(summary.skipped.map((r) => r.pr)).toEqual([3]);
  });
});
