import {
  MergedWeek,
  ReleaseTimeline,
  TimelineRelease,
  UNRELEASED_KEY,
  UnreleasedWork,
  VersionBump,
} from '../../../core/releases/release-timeline';
import { Stage, alongPath, pathAt } from './release-path';

/** A release as a star on the trajectory, in CSS pixels. */
export interface PlacedRelease {
  readonly key: string;
  readonly tag: string;
  readonly publishedAt: number;
  /** Where on the path it sits, from 0 (the far past) to 1. */
  readonly t: number;
  readonly x: number;
  readonly y: number;
  readonly depth: number;
  readonly radius: number;
  readonly count: number;
  readonly bump: VersionBump;
  readonly isPrerelease: boolean;
  /** Its place in the order the sky lights them, oldest first. */
  readonly order: number;
  /** Whether its name fits under it without running into the next one's. */
  readonly hasLabel: boolean;
}

/** One week of unreleased work: a knot in the comet's tail. */
export interface PlacedWeek {
  readonly key: string;
  readonly start: number;
  readonly count: number;
  /** Where on the path it sits, and how far along the path it reaches each way. */
  readonly t: number;
  readonly reach: number;
  readonly x: number;
  readonly y: number;
  /** How wide the tail is here, in pixels each side of the path. */
  readonly spread: number;
}

/** The Unreleased comet: its head at the leading edge, its tail back along the path. */
export interface PlacedComet {
  readonly key: string;
  readonly x: number;
  readonly y: number;
  readonly depth: number;
  readonly radius: number;
  readonly count: number;
  readonly t: number;
  /** Where the tail fades out, on the path. */
  readonly tailStart: number;
  /** Oldest first. */
  readonly weeks: readonly PlacedWeek[];
}

export interface TimelineLayout {
  /** Oldest first. */
  readonly releases: readonly PlacedRelease[];
  readonly comet: PlacedComet | null;
}

const T_START = 0.05;
/** Where the comet's head rides, short of the end so its glow stays on screen. */
const T_HEAD = 0.9;
/** Where the newest release sits when nothing has merged since. */
const T_END_WITHOUT_COMET = 0.86;
/** With no release yet, the tail has the whole path. */
const T_TAIL_ALONE = 0.08;
const TAIL_SHARE_MIN = 0.16;
const TAIL_SHARE_MAX = 0.36;
const TAIL_SHARE_PER_WEEK = 0.05;
/** Between the newest release and where the tail fades in. */
const TAIL_GAP = 0.03;
/** The last of the tail before the head, kept clear of its glow. */
const HEAD_CLEAR = 0.025;
/** Above 1, older releases crowd into the distance and newer ones get room. */
const RELEASE_EASE = 1.35;
const BODY_BASE_PX = 7;
const BODY_GROWTH_PX = 2.4;
const BODY_MAX_PX = 28;
/** A star takes at most this share of the gap to its nearest neighbour, so neighbours never merge. */
const ROOM_SHARE = 0.42;
const HEAD_BASE_PX = 9;
const HEAD_GROWTH_PX = 0.9;
const HEAD_MAX_PX = 24;
/** A name needs this much room along the screen before the next one. */
const LABEL_ROOM_PX = 96;
const SPREAD_NEAR_PX = 12;
const SPREAD_FAR_PX = 28;
const SPREAD_PER_ROOT_PX = 1.5;
const SPREAD_CROWD_MAX_PX = 16;

const clamp = (value: number, low: number, high: number): number =>
  Math.min(high, Math.max(low, value));

/** A star's size: larger for more merged work, smaller with distance. */
export const bodyRadius = (count: number, depth: number): number =>
  depth * Math.min(BODY_MAX_PX, BODY_BASE_PX + BODY_GROWTH_PX * Math.sqrt(count));

/** The share of the path the tail takes when releases share it: longer for more weeks. */
export const tailShare = (weeks: number): number =>
  clamp(TAIL_SHARE_MIN + TAIL_SHARE_PER_WEEK * (weeks - 1), TAIL_SHARE_MIN, TAIL_SHARE_MAX);

function releaseRange(timeline: ReleaseTimeline): readonly [number, number] {
  const { unreleased } = timeline;
  if (!unreleased) return [T_START, T_END_WITHOUT_COMET];
  return [T_START, T_HEAD - tailShare(unreleased.weeks.length) - TAIL_GAP];
}

function placeReleases(
  releases: readonly TimelineRelease[],
  range: readonly [number, number],
  stage: Stage,
): PlacedRelease[] {
  const ruler = alongPath(range, stage);
  const shares = releases.map((_, index) =>
    releases.length === 1 ? 1 : Math.pow(index / (releases.length - 1), RELEASE_EASE),
  );
  const placed = releases.map((entry, index): PlacedRelease => {
    const t = ruler.tAt(shares[index]);
    const point = pathAt(t, stage);
    const { release, bump } = entry;
    return {
      key: release.tag,
      tag: release.tag,
      publishedAt: release.publishedAt,
      t,
      x: point.x,
      y: point.y,
      depth: point.depth,
      radius: Math.min(
        bodyRadius(release.pulls.length, point.depth),
        roomAround(shares, index) * ruler.length * ROOM_SHARE,
      ),
      count: release.pulls.length,
      bump,
      isPrerelease: release.isPrerelease,
      order: index,
      hasLabel: false,
    };
  });
  return withLabels(placed);
}

/** The share of the path between a release and its nearest neighbour; all of it for one alone. */
function roomAround(shares: readonly number[], index: number): number {
  const before = index > 0 ? shares[index] - shares[index - 1] : Infinity;
  const after = index < shares.length - 1 ? shares[index + 1] - shares[index] : Infinity;
  return Math.min(before, after, 1);
}

/** Names go to the newest first, and to an older one only where it clears the last named. */
function withLabels(placed: readonly PlacedRelease[]): PlacedRelease[] {
  let lastX = Infinity;
  const labelled = [...placed].reverse().map((release) => {
    const hasLabel = lastX - release.x >= LABEL_ROOM_PX;
    if (hasLabel) lastX = release.x;
    return { ...release, hasLabel };
  });
  return labelled.reverse();
}

function placeWeeks(
  weeks: readonly MergedWeek[],
  tail: readonly [number, number],
  stage: Stage,
): PlacedWeek[] {
  const [from, to] = tail;
  const reach = (to - from) / (2 * Math.max(weeks.length, 1));
  return weeks.map((week, index) => {
    const t = from + reach * (2 * index + 1);
    const point = pathAt(t, stage);
    const nearHead = (index + 1) / weeks.length;
    const crowd = Math.min(SPREAD_CROWD_MAX_PX, SPREAD_PER_ROOT_PX * Math.sqrt(week.pulls.length));
    return {
      key: week.key,
      start: week.start,
      count: week.pulls.length,
      t,
      reach,
      x: point.x,
      y: point.y,
      spread: point.depth * (SPREAD_NEAR_PX + SPREAD_FAR_PX * (1 - nearHead)) + crowd,
    };
  });
}

function placeComet(unreleased: UnreleasedWork, tailStart: number, stage: Stage): PlacedComet {
  const head = pathAt(T_HEAD, stage);
  const count = unreleased.pulls.length;
  return {
    key: UNRELEASED_KEY,
    x: head.x,
    y: head.y,
    depth: head.depth,
    radius: head.depth * Math.min(HEAD_MAX_PX, HEAD_BASE_PX + HEAD_GROWTH_PX * Math.sqrt(count)),
    count,
    t: T_HEAD,
    tailStart,
    weeks: placeWeeks(unreleased.weeks, [tailStart, T_HEAD - HEAD_CLEAR], stage),
  };
}

/** Where every release and the Unreleased comet sit on `stage`. */
export function layoutTimeline(timeline: ReleaseTimeline, stage: Stage): TimelineLayout {
  const range = releaseRange(timeline);
  const releases = placeReleases(timeline.releases, range, stage);
  const { unreleased } = timeline;
  if (!unreleased) return { releases, comet: null };
  const tailStart = releases.length ? range[1] + TAIL_GAP : T_TAIL_ALONE;
  return { releases, comet: placeComet(unreleased, tailStart, stage) };
}
