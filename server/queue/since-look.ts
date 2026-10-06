import type { Comparison } from '../github/compare-reader.ts';
import type { TriagedItem, TriagedQueue } from '../triage/triaged-queue.ts';
import type { PullExtras } from './pull-detail.ts';
import { fitDiff } from './pull-size.ts';

/** What happened to a pull request's head since it was last looked at. */
export interface SinceLook {
  /** Commits pushed on top of the head looked at; null when they cannot be counted,
   *  because the branch was rewritten, as by a force-push. */
  readonly newCommits: number | null;
}

/** A queue item with what changed on it since it was last looked at, or null for nothing. */
export type LookedItem = TriagedItem & { readonly sinceLook: SinceLook | null };

export interface LookedQueue extends Omit<TriagedQueue, 'items'> {
  readonly items: readonly LookedItem[];
}

/** Reads what changed between two heads of one repository. */
export type SinceLookRead = (base: string, head: string) => Promise<SinceLook>;

export function sinceLookOf(comparison: Comparison): SinceLook {
  return { newCommits: comparison.status === 'ahead' ? comparison.aheadBy : null };
}

const hasMoved = (item: TriagedItem): item is TriagedItem & { lookedSha: string } =>
  item.lookedSha !== null && item.headSha !== '' && item.lookedSha !== item.headSha;

/** The head is known to have moved even when GitHub cannot say how: it may have
 *  forgotten the head looked at after a force-push. */
const UNCOUNTED: SinceLook = { newCommits: null };

async function lookedItem(item: TriagedItem, read: SinceLookRead): Promise<LookedItem> {
  if (!hasMoved(item)) return { ...item, sinceLook: null };
  const sinceLook = await read(item.lookedSha, item.headSha).catch(() => UNCOUNTED);
  return { ...item, sinceLook };
}

/** The queue with what changed on each pull request since it was last looked at. */
export async function withSinceLook(
  queue: TriagedQueue,
  read: SinceLookRead,
): Promise<LookedQueue> {
  return { ...queue, items: await Promise.all(queue.items.map((item) => lookedItem(item, read))) };
}

/** What `GET /api/since-look` returns: the changes between the head looked at and the
 *  head now, cut to fit like a pull request's diff. */
export interface SinceLookDiff {
  readonly base: string;
  readonly head: string;
  readonly newCommits: number | null;
  /** Empty when the branch was rewritten, or the diff is too large for GitHub to give. */
  readonly diff: string;
  readonly diffBytes: number;
  readonly diffTruncated: boolean;
  /** The preview withholds a private repository's code. */
  readonly diffHidden: boolean;
  readonly fetchedAt: string;
}

interface Heads {
  readonly base: string;
  readonly head: string;
  readonly since: SinceLook;
}

export function sinceLookDiffOf({ base, head, since }: Heads, extras: PullExtras): SinceLookDiff {
  const diff = since.newCommits === null ? '' : extras.diff;
  return fitDiff({
    base,
    head,
    newCommits: since.newCommits,
    diff,
    diffBytes: diff.length,
    diffTruncated: false,
    diffHidden: false,
    fetchedAt: extras.fetchedAt,
  });
}
