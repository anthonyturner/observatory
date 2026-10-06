import { QueueItem } from '../../../core/queue/queue-report';
import { wipCheck } from './wip-check';

const pull = (number: number, extra: Partial<QueueItem> = {}): QueueItem => ({
  number,
  title: `Change ${number}`,
  url: `https://github.com/me/a/pull/${number}`,
  isDraft: false,
  bucket: 'unreviewed',
  closes: [],
  failingChecks: 0,
  flakyChecks: [],
  additions: 10,
  deletions: 0,
  idleDays: 1,
  ageDays: 1,
  branch: `h${number}`,
  base: 'main',
  mergeable: 'MERGEABLE',
  changedFiles: 1,
  isSeen: false,
  hidden: null,
  lookedSha: null,
  sinceLook: null,
  ...extra,
});

const pulls = (count: number, extra: Partial<QueueItem> = {}): QueueItem[] =>
  Array.from({ length: count }, (_, i) => pull(i + 1, extra));

describe('wipCheck', () => {
  it('is not over with nothing open', () => {
    expect(wipCheck([], 8)).toEqual({ open: 0, limit: 8, isOver: false });
  });

  it('is not over at the limit, only past it', () => {
    expect(wipCheck(pulls(8), 8).isOver).toBe(false);
    expect(wipCheck(pulls(9), 8)).toEqual({ open: 9, limit: 8, isOver: true });
  });

  it('leaves drafts out of the count', () => {
    const check = wipCheck([...pulls(8), pull(20, { isDraft: true })], 8);

    expect(check.open).toBe(8);
    expect(check.isOver).toBe(false);
  });

  it('still counts snoozed and dismissed pull requests, which are still open', () => {
    const check = wipCheck(
      [
        pull(1, { hidden: { reason: 'dismissed' } }),
        pull(2, { hidden: { reason: 'snoozed', until: '2026-10-10T00:00:00Z' } }),
      ],
      1,
    );

    expect(check).toEqual({ open: 2, limit: 1, isOver: true });
  });

  it('falls back under a raised limit', () => {
    expect(wipCheck(pulls(9), 10).isOver).toBe(false);
  });
});
