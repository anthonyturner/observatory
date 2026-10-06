import { QueueItem } from '../../core/queue/queue-report';
import { skyItemOf, skyPairOf } from './sky-items';
import { SPRINT_FILTER, filterFor } from './starmap-sky/starmap-sky';
import { SkyStar } from './engine/sky-model';

const item: QueueItem = {
  number: 7,
  title: 'Fix it',
  url: 'https://github.com/me/a/pull/7',
  isDraft: false,
  bucket: 'unreviewed',
  closes: [3, 4],
  failingChecks: 0,
  flakyChecks: [],
  additions: 10,
  deletions: 2,
  idleDays: 5,
  ageDays: 9,
  branch: 'feat/7',
  base: 'main',
  mergeable: 'MERGEABLE',
  changedFiles: 2,
  isSeen: true,
  hidden: null,
  lookedSha: null,
  sinceLook: null,
};

describe('skyItemOf', () => {
  it('charts a seen pull request waiting on you as Seen recently', () => {
    expect(skyItemOf(item)).toEqual({
      pr: 7,
      title: 'Fix it',
      bucket: 'fresh',
      idleDays: 5,
      additions: 10,
      deletions: 2,
      issues: [3, 4],
    });
  });
});

describe('skyPairOf', () => {
  it('reads conflicts as true, clean as false and unchecked as null', () => {
    const files = ['a.ts', 'b.ts'];
    expect(skyPairOf({ a: 1, b: 2, files, conflicts: ['a.ts'] }).conflict).toBe(true);
    expect(skyPairOf({ a: 1, b: 2, files, conflicts: [] }).conflict).toBe(false);
    expect(skyPairOf({ a: 1, b: 2, files, conflicts: null })).toEqual({
      a: 1,
      b: 2,
      conflict: null,
      conflictFiles: undefined,
      sharedCount: 2,
    });
  });
});

describe('filterFor', () => {
  const star = (key: string, quick: boolean) => ({ key, quick }) as unknown as SkyStar;

  it('lights one bucket, the quick wins across buckets, or everything', () => {
    expect(filterFor(null)).toBeNull();
    expect(filterFor('failing')?.(star('failing', false))).toBe(true);
    expect(filterFor('failing')?.(star('unknown', false))).toBe(false);
    expect(filterFor('quick')?.(star('unreviewed', true))).toBe(true);
  });

  it('lights only a review sprint’s pull requests', () => {
    const pull = (pr: number) => ({ item: { pr } }) as unknown as SkyStar;
    const lit = filterFor(SPRINT_FILTER, [4, 5]);
    expect(lit?.(pull(5))).toBe(true);
    expect(lit?.(pull(6))).toBe(false);
  });
});
