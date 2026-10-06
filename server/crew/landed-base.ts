import type { MergedBranch } from '../history/ledger.ts';
import type { QueueItem } from '../queue/queue-report.ts';

/** The pull request a branch was stacked on, now merged, and the branch it merged into. */
export interface LandedBase {
  readonly number: number;
  readonly branch: string;
  readonly into: string;
}

/**
 * Where pull request `item`'s base went: the merge that landed it, or null
 * while it is the default branch or another open pull request's head.
 * `merged` is newest first, so a reused branch name means its latest merge.
 */
export function landedBaseOf(
  item: Pick<QueueItem, 'number' | 'base'>,
  open: readonly Pick<QueueItem, 'number' | 'branch'>[],
  merged: readonly MergedBranch[],
): LandedBase | null {
  if (!item.base) return null;
  if (open.some((other) => other.number !== item.number && other.branch === item.base)) return null;
  const landed = merged.find((each) => each.head === item.base);
  return landed ? { number: landed.number, branch: landed.head, into: landed.base } : null;
}
