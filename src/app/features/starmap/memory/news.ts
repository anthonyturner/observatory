import { Lookup, PullState } from '../../../core/activity/activity-lookups';
import { Frame } from '../../../core/queue/history-report';
import { Ledger } from '../../../core/queue/ledger';
import { rnd } from '../engine/rnd';
import { BucketId, SkyCluster, WORLD } from '../engine/sky-model';
import { Departure, EMPTY_SYSTEM, Ending, StarSystem, endingOf, endingOfPull } from './departure';
import { MERGE_SPAN_S } from './merge-supernova';

/* pr-starmap's memory, kept apart as it kept it: `diffItems` only compares,
   EFFECTS only says how each kind of change looks, and the panel, the timeline
   and replay only consume events. */

/** `merged` is a merge commit, or a merge whose way nobody recorded; `squashed`
 *  is a squash or a rebase, which leave their commits on the base alike. */
export type ChangeKind =
  'blocked' | 'opened' | 'merged' | 'squashed' | 'unblocked' | 'closed' | 'left';

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
  /** What a pull request that left the sky took with it; only on those that left. */
  readonly departure?: Departure;
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
  /** Whether a brief flash still plays when motion is off; every other burst is skipped. */
  readonly flashesStill: boolean;
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
    flashesStill: false,
  },
  opened: {
    rank: 1,
    noun: 'opened',
    tag: 'NEW',
    colour: '#ffffff',
    onStar: true,
    span: 1.4,
    mark: [2, 6],
    flashesStill: false,
  },
  merged: {
    rank: 2,
    noun: 'merged',
    tag: 'merged',
    colour: '#5fe3a1',
    onStar: false,
    span: MERGE_SPAN_S,
    mark: null,
    flashesStill: true,
  },
  squashed: {
    rank: 3,
    noun: 'squashed',
    tag: 'squashed',
    colour: '#5fe3a1',
    onStar: false,
    span: MERGE_SPAN_S,
    mark: null,
    flashesStill: true,
  },
  unblocked: {
    rank: 4,
    noun: 'unblocked',
    tag: 'UNBLOCKED',
    colour: '#5fe3a1',
    onStar: true,
    span: 1.8,
    mark: [1, 7],
    flashesStill: false,
  },
  closed: {
    rank: 5,
    noun: 'closed unmerged',
    tag: 'closed',
    colour: '#8d9bc4',
    onStar: false,
    span: 2.0,
    mark: null,
    flashesStill: false,
  },
  left: {
    rank: 6,
    noun: 'left the queue',
    tag: 'left',
    colour: '#8d9bc4',
    onStar: false,
    span: 2.0,
    mark: null,
    flashesStill: false,
  },
};

const BLOCKED: ReadonlySet<BucketId> = new Set(['conflicted', 'failing']);

/** How an ending reads on the sky; a pull request that left with none known just left. */
export function kindOf(ending: Ending | null): ChangeKind {
  if (!ending) return 'left';
  if (ending.fate === 'closed') return 'closed';
  return ending.how === 'squash' ? 'squashed' : 'merged';
}

/** The pull requests in `before` that are not in `after`. */
export const departedFrom = (
  before: readonly MemoryItem[],
  after: readonly MemoryItem[],
): MemoryItem[] => {
  const now = new Set(after.map((i) => i.pr));
  return before.filter((i) => !now.has(i.pr));
};

const worstFirst = (a: NewsEvent, b: NewsEvent): number =>
  EFFECTS[a.kind].rank - EFFECTS[b.kind].rank || a.pr - b.pr;

/** The news of pull requests that left, each with the system its star carried
 *  and how it ended, where those are known. */
export function departureEvents(
  gone: readonly MemoryItem[],
  endings: ReadonlyMap<number, Ending> = new Map(),
  systems: ReadonlyMap<number, StarSystem> = new Map(),
): NewsEvent[] {
  return gone
    .map((i): NewsEvent => {
      const ending = endings.get(i.pr) ?? null;
      return {
        kind: kindOf(ending),
        pr: i.pr,
        title: i.title,
        bucket: i.bucket,
        departure: { system: systems.get(i.pr) ?? EMPTY_SYSTEM, ending },
      };
    })
    .sort(worstFirst);
}

/**
 * The news of `gone`, once GitHub has answered for each in turn. One it says is
 * still open did not leave (the queue only stopped showing it) and is no news;
 * one it could not answer for just left.
 */
export function departuresAnswered(
  gone: readonly MemoryItem[],
  answers: readonly Lookup<PullState>[],
  systems: ReadonlyMap<number, StarSystem>,
): NewsEvent[] {
  const left: MemoryItem[] = [];
  const endings = new Map<number, Ending>();
  gone.forEach((each, i) => {
    const answer = answers[i];
    const ending = answer.status === 'found' ? endingOfPull(answer.value) : null;
    if (answer.status === 'found' && !ending) return;
    left.push(each);
    if (ending) endings.set(each.pr, ending);
  });
  return departureEvents(left, endings, systems);
}

/** Whether a kind of change is a pull request leaving the sky rather than changing on it. */
export const isDeparture = (kind: ChangeKind): boolean => !EFFECTS[kind].onStar;

/** What changed between two queues: items in, events out, worst first. */
export function diffItems(
  before: readonly MemoryItem[],
  after: readonly MemoryItem[],
  endings: ReadonlyMap<number, Ending> = new Map(),
  systems: ReadonlyMap<number, StarSystem> = new Map(),
): NewsEvent[] {
  const was = new Map(before.map((i) => [i.pr, i]));
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
  events.push(...departureEvents(departedFrom(before, after), endings, systems));
  return events.sort(worstFirst);
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
 *  first, the ledger after. Neither knows the threads or the issues closed. */
export function knownEndings(frames: readonly Frame[], ledger: Ledger | null): Map<number, Ending> {
  const endings = new Map<number, Ending>();
  for (const row of ledger?.rows ?? []) {
    for (const pr of row.closed) endings.set(pr, endingOf('closed'));
    for (const pr of row.merged) endings.set(pr, endingOf('merged'));
  }
  for (const f of frames) {
    for (const d of f.departed) endings.set(d.number, endingOf(d.fate, d.how ?? null));
  }
  return endings;
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
