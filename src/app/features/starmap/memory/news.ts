import { Frame } from '../../../core/queue/history-report';
import { Ledger } from '../../../core/queue/ledger';
import { rnd } from '../engine/rnd';
import { BucketId, SkyCluster, WORLD } from '../engine/sky-model';

/* pr-starmap's memory, kept apart as it kept it: `diffItems` only compares,
   EFFECTS only says how each kind of change looks, and the panel, the timeline
   and replay only consume events. */

export type ChangeKind = 'blocked' | 'opened' | 'merged' | 'unblocked' | 'closed' | 'left';

/** A pull request as the memory compares it. */
export interface MemoryItem {
  readonly pr: number;
  readonly title: string;
  readonly bucket: BucketId;
  readonly idleDays: number;
}

/** One change between two queues, and where it plays. */
export interface NewsEvent {
  readonly kind: ChangeKind;
  readonly pr: number;
  readonly title: string;
  readonly bucket: BucketId;
  /** When its burst starts, in wall seconds; set by `play`. */
  startAt?: number;
  /** Where a pull request that left crosses the sky from, and which way. */
  fromX?: number;
  fromY?: number;
  fromZ?: number;
  angle?: number;
  /** The head of a crossing, on screen, for its label. */
  head?: [number, number] | null;
}

export interface Effect {
  /** Worst news first: the order the panel lists and the sky plays them. */
  readonly rank: number;
  readonly noun: string;
  readonly tag: string;
  readonly colour: string;
  /** Whether it happens to a star still in the sky. */
  readonly onStar: boolean;
  /** How long its burst plays, in seconds. */
  readonly span: number;
  /** The dash of the ring that lingers until the news is seen, if it lingers. */
  readonly mark: readonly number[] | null;
}

export const EFFECTS: Readonly<Record<ChangeKind, Effect>> = {
  blocked: {
    rank: 0,
    noun: 'newly blocked',
    tag: 'NEWLY BLOCKED',
    colour: '#ff6f5e',
    onStar: true,
    span: 2.6,
    mark: [6, 5],
  },
  opened: {
    rank: 1,
    noun: 'opened',
    tag: 'NEW',
    colour: '#ffffff',
    onStar: true,
    span: 1.4,
    mark: [2, 6],
  },
  merged: {
    rank: 2,
    noun: 'merged',
    tag: 'merged',
    colour: '#5fe3a1',
    onStar: false,
    span: 2.0,
    mark: null,
  },
  unblocked: {
    rank: 3,
    noun: 'unblocked',
    tag: 'UNBLOCKED',
    colour: '#5fe3a1',
    onStar: true,
    span: 1.8,
    mark: [1, 7],
  },
  closed: {
    rank: 4,
    noun: 'closed unmerged',
    tag: 'closed',
    colour: '#8d9bc4',
    onStar: false,
    span: 2.0,
    mark: null,
  },
  left: {
    rank: 5,
    noun: 'left the queue',
    tag: 'left',
    colour: '#8d9bc4',
    onStar: false,
    span: 2.0,
    mark: null,
  },
};

const BLOCKED: ReadonlySet<BucketId> = new Set(['conflicted', 'failing']);

/** What changed between two queues: items in, events out, worst first. */
export function diffItems(
  before: readonly MemoryItem[],
  after: readonly MemoryItem[],
  fates: ReadonlyMap<number, 'merged' | 'closed'> = new Map(),
): NewsEvent[] {
  const was = new Map(before.map((i) => [i.pr, i]));
  const now = new Map(after.map((i) => [i.pr, i]));
  const events: NewsEvent[] = [];
  for (const i of after) {
    const old = was.get(i.pr);
    const event = { pr: i.pr, title: i.title, bucket: i.bucket };
    if (!old) events.push({ kind: 'opened', ...event });
    else if (BLOCKED.has(i.bucket) && !BLOCKED.has(old.bucket))
      events.push({ kind: 'blocked', ...event });
    else if (!BLOCKED.has(i.bucket) && BLOCKED.has(old.bucket))
      events.push({ kind: 'unblocked', ...event });
  }
  for (const i of before) {
    if (now.has(i.pr)) continue;
    events.push({ kind: fates.get(i.pr) ?? 'left', pr: i.pr, title: i.title, bucket: i.bucket });
  }
  return events.sort((a, b) => EFFECTS[a.kind].rank - EFFECTS[b.kind].rank || a.pr - b.pr);
}

/** A frame's items in the memory's shape. */
export const frameItems = (frame: Frame): MemoryItem[] =>
  frame.items.map((i) => ({
    pr: i.number,
    title: i.title,
    bucket: i.bucket,
    idleDays: i.idleDays,
  }));

/** How every pull request that left the queue left it: the frames' own records
 *  first, the ledger after. */
export function knownFates(
  frames: readonly Frame[],
  ledger: Ledger | null,
): Map<number, 'merged' | 'closed'> {
  const fates = new Map<number, 'merged' | 'closed'>();
  for (const row of ledger?.rows ?? []) {
    for (const pr of row.closed) fates.set(pr, 'closed');
    for (const pr of row.merged) fates.set(pr, 'merged');
  }
  for (const f of frames) for (const d of f.departed) fates.set(d.number, d.fate);
  return fates;
}

/** The frame the live sky is compared with, and how to describe it. */
export interface Baseline {
  readonly frame: Frame;
  readonly label: string;
  readonly since: string;
}

const findLastIndex = <T>(items: readonly T[], test: (item: T) => boolean): number => {
  for (let i = items.length - 1; i >= 0; i--) if (test(items[i])) return i;
  return -1;
};

/**
 * pr-starmap's baseline: since your last visit (the snapshot you last saw), or
 * on a first visit, what the latest refresh changed. The refresh records its
 * frame just before its snapshot, so the newest frame at or before the
 * snapshot is the snapshot; the one before it is the baseline.
 */
export function baseline(
  frames: readonly Frame[],
  lastSeen: string | null,
  snapshotAt: string,
): Baseline | null {
  if (lastSeen) {
    if (lastSeen >= snapshotAt) return null;
    const i = findLastIndex(frames, (f) => f.at <= lastSeen);
    if (i >= 0) return { frame: frames[i], label: 'since you last looked', since: frames[i].at };
    return frames.length
      ? { frame: frames[0], label: 'since memory began', since: frames[0].at }
      : null;
  }
  const i = findLastIndex(frames, (f) => f.at <= snapshotAt) - 1;
  return i >= 0
    ? { frame: frames[i], label: 'since the previous refresh', since: frames[i].at }
    : null;
}

/**
 * Starts each event's burst, staggered so a busy day reads as a sequence, after
 * the sky's entrance so a burst never lands on a star not yet arrived. A pull
 * request that left crosses from where its constellation is now.
 */
export function play(
  events: readonly NewsEvent[],
  clusters: readonly SkyCluster[],
  { now, entranceEnd, frozen }: { now: number; entranceEnd: number; frozen: boolean },
): void {
  const wall = Math.max(now + 0.5, frozen ? now : entranceEnd);
  events.forEach((ev, i) => {
    ev.startAt = wall + i * 0.32;
    ev.head = null;
    if (EFFECTS[ev.kind].onStar) return;
    const home = clusters.find((cl) => cl.stars.some((s) => s.key === ev.bucket));
    const r = rnd(ev.pr * 104723);
    ev.fromX = (home?.cx ?? WORLD.w / 2) + (r() - 0.5) * 160;
    ev.fromZ = home?.z ?? 0;
    ev.fromY = (home?.cy ?? WORLD.h / 2) + (r() - 0.5) * 120;
    ev.angle = (r() < 0.5 ? 0.35 : Math.PI - 0.35) + (r() - 0.5) * 0.5;
  });
}
