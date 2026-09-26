import { PullBucket } from '../projects/projects-report';
import { Frame } from './history-report';
import { QueueItem } from './queue-report';

export interface ChangedPull {
  readonly number: number;
  readonly title: string;
}

/** What changed between a remembered frame and the queue now. */
export interface Changes {
  /** When the comparison starts. */
  readonly since: string;
  /** From your last visit, or, on a first visit, from the refresh before. */
  readonly basis: 'visit' | 'refresh';
  readonly opened: readonly ChangedPull[];
  readonly blocked: readonly ChangedPull[];
  readonly unblocked: readonly ChangedPull[];
  readonly merged: readonly ChangedPull[];
  readonly closed: readonly ChangedPull[];
}

const isBlocked = (bucket: PullBucket): boolean => bucket === 'conflicted' || bucket === 'failing';

/** The frame to compare with: the newest at or before the last visit, the
 *  oldest if the visit predates them all, or the one before the newest on a
 *  first visit. Null when there is nothing to compare with. */
function baselineOf(
  frames: readonly Frame[],
  lastSeen: number | null,
): { readonly frame: Frame; readonly basis: Changes['basis'] } | null {
  if (lastSeen === null) {
    const frame = frames.at(-2);
    return frame ? { frame, basis: 'refresh' } : null;
  }
  const before = frames.filter((frame) => Date.parse(frame.at) <= lastSeen);
  const frame = before.at(-1) ?? frames[0];
  return frame ? { frame, basis: 'visit' } : null;
}

const pullOf = ({ number, title }: ChangedPull): ChangedPull => ({ number, title });

/** What changed in the queue read at `readAt` since `lastSeen` (both ms), or
 *  null when you have seen this read or nothing is remembered from before. */
export function changesSince(
  frames: readonly Frame[],
  items: readonly QueueItem[],
  lastSeen: number | null,
  readAt: number,
): Changes | null {
  if (lastSeen !== null && lastSeen >= readAt) return null;
  const baseline = baselineOf(frames, lastSeen);
  if (!baseline) return null;
  const was = new Map(baseline.frame.items.map((item) => [item.number, item.bucket]));
  const open = new Set(items.map((item) => item.number));
  const movedBetween = (from: boolean, to: boolean) => (item: QueueItem) => {
    const bucket = was.get(item.number);
    return bucket !== undefined && isBlocked(bucket) === from && isBlocked(item.bucket) === to;
  };
  const departed = frames
    .filter((frame) => frame.at > baseline.frame.at)
    .flatMap((frame) => frame.departed)
    .filter((each) => !open.has(each.number));
  return {
    since: baseline.frame.at,
    basis: baseline.basis,
    opened: items.filter((item) => !was.has(item.number)).map(pullOf),
    blocked: items.filter(movedBetween(false, true)).map(pullOf),
    unblocked: items.filter(movedBetween(true, false)).map(pullOf),
    merged: departed.filter((each) => each.fate === 'merged').map(pullOf),
    closed: departed.filter((each) => each.fate === 'closed').map(pullOf),
  };
}

export const changeCount = (changes: Changes | null): number =>
  changes
    ? changes.opened.length +
      changes.blocked.length +
      changes.unblocked.length +
      changes.merged.length +
      changes.closed.length
    : 0;
