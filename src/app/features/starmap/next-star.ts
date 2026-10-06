import { QueueItem } from '../../core/queue/queue-report';
import { BUCKETS, BY_ID, BucketId, SkyItem, isQuick } from './engine/sky-model';
import { skyItemOf } from './sky-items';

/** The pull request to work next, and why it was picked. */
export interface NextStar {
  readonly pr: number;
  readonly title: string;
  /** "Cannot merge, idle 6 days". */
  readonly why: string;
}

const BUCKET_RANK: ReadonlyMap<BucketId, number> = new Map(BUCKETS.map((b, i) => [b.id, i]));
/** Where a pull request's bucket sits in the queue, blocked first. */
export const rankOf = (item: SkyItem): number => BUCKET_RANK.get(item.bucket) ?? BUCKETS.length;

/** In the queue and ready to work: not snoozed, dismissed or a draft. */
export const isWorkable = (item: QueueItem): boolean => item.hidden === null && !item.isDraft;

/** Longest idle first; a tie goes to a quick win, then the lower number. */
const byNeglect = (a: SkyItem, b: SkyItem): number =>
  b.idleDays - a.idleDays || Number(isQuick(b)) - Number(isQuick(a)) || a.pr - b.pr;

/** The queue's own order: the most blocked bucket first, then the most neglected. */
export const byBlockedFirst = (a: SkyItem, b: SkyItem): number =>
  rankOf(a) - rankOf(b) || byNeglect(a, b);

/** The workable pull requests in the order Next star works through them, the
 *  merge plan aside. */
export const blockedFirst = (items: readonly QueueItem[]): SkyItem[] =>
  items.filter(isWorkable).map(skyItemOf).sort(byBlockedFirst);

/**
 * The best pull request to work next: from the blocked-first bucket, the merge
 * plan's first workable step when it sits there, else the longest idle.
 * `planOrder` is the merge plan's pull request numbers, first step first.
 */
export function nextStar(
  items: readonly QueueItem[],
  planOrder: readonly number[],
): NextStar | null {
  const ordered = blockedFirst(items);
  if (!ordered.length) return null;
  const top = ordered.filter((item) => rankOf(item) === rankOf(ordered[0]));
  const planFirst = planOrder.find((pr) => ordered.some((item) => item.pr === pr));
  const planned = top.find((item) => item.pr === planFirst);
  const picked = planned ?? top[0];
  return { pr: picked.pr, title: picked.title, why: whyOf(picked, picked === planned) };
}

/** Where a pull request stands, plan aside: "Cannot merge, quick win, idle 6 days". */
export const standingOf = (item: SkyItem): string => whyOf(item, false);

function whyOf(item: SkyItem, isPlanFirst: boolean): string {
  const days = `idle ${item.idleDays} day${item.idleDays === 1 ? '' : 's'}`;
  return [
    BY_ID.get(item.bucket)?.sub,
    isPlanFirst ? 'first in the merge plan' : null,
    isQuick(item) ? 'quick win' : null,
    days,
  ]
    .filter((part) => part)
    .join(', ');
}
