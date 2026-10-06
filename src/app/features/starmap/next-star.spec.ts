import { QueueItem } from '../../core/queue/queue-report';
import { nextStar } from './next-star';

const pull = (number: number, extra: Partial<QueueItem> = {}): QueueItem => ({
  number,
  title: `Change ${number}`,
  url: `https://github.com/me/a/pull/${number}`,
  isDraft: false,
  bucket: 'unreviewed',
  closes: [number + 100],
  failingChecks: 0,
  additions: 400,
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

describe('nextStar', () => {
  it('has nothing to pick from an empty queue', () => {
    expect(nextStar([], [])).toBeNull();
  });

  it('takes the blocked-first bucket before a longer-idle one further down', () => {
    const picked = nextStar(
      [pull(1, { idleDays: 30 }), pull(2, { bucket: 'failing', idleDays: 1 })],
      [],
    );

    expect(picked?.pr).toBe(2);
  });

  it('takes the longest idle within the bucket, and says why', () => {
    const picked = nextStar(
      [
        pull(1, { bucket: 'conflicted', idleDays: 3 }),
        pull(2, { bucket: 'conflicted', idleDays: 6 }),
      ],
      [],
    );

    expect(picked).toEqual({ pr: 2, title: 'Change 2', why: 'Cannot merge, idle 6 days' });
  });

  it('prefers the merge plan’s first step when it sits in that bucket', () => {
    const picked = nextStar([pull(1, { idleDays: 9 }), pull(2, { idleDays: 1 })], [2, 1]);

    expect(picked).toEqual({
      pr: 2,
      title: 'Change 2',
      why: 'Waiting on you, first in the merge plan, idle 1 day',
    });
  });

  it('keeps to the bucket when the plan’s first step sits further down', () => {
    const picked = nextStar([pull(1), pull(2, { bucket: 'failing' })], [1, 2]);

    expect(picked?.pr).toBe(2);
  });

  it('breaks a tie on idle days with a quick win, then the lower number', () => {
    const quick = { additions: 20, deletions: 5 };

    expect(nextStar([pull(1), pull(3, quick), pull(2, quick)], [])).toEqual({
      pr: 2,
      title: 'Change 2',
      why: 'Waiting on you, quick win, idle 2 days',
    });
  });

  it('skips snoozed, dismissed and draft pull requests, plan step or not', () => {
    const picked = nextStar(
      [
        pull(1, { bucket: 'conflicted', isDraft: true }),
        pull(2, { bucket: 'conflicted', hidden: { reason: 'dismissed' } }),
        pull(3, { bucket: 'failing', hidden: { reason: 'snoozed', until: '2026-10-09' } }),
        pull(4, { idleDays: 1 }),
        pull(5, { idleDays: 8 }),
      ],
      [1, 2, 3, 4, 5],
    );

    expect(picked?.pr).toBe(4);
  });

  it('has nothing to pick when only drafts and hidden ones are open', () => {
    expect(
      nextStar([pull(1, { isDraft: true }), pull(2, { hidden: { reason: 'dismissed' } })], []),
    ).toBeNull();
  });

  it('reads a seen, waiting pull request as Seen recently, after the ones still waiting', () => {
    const picked = nextStar([pull(1, { isSeen: true, idleDays: 20 }), pull(2)], []);

    expect(picked?.pr).toBe(2);
  });
});
