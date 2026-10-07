import { ActionsRun, RunOutcome } from '../../../core/actions/actions-report';
import { Stage } from '../../releases/release-sky/release-path';

export interface Point {
  readonly x: number;
  readonly y: number;
}

/** A run placed on its workflow's lane. */
export interface PlacedRun {
  readonly key: string;
  readonly run: ActionsRun;
  readonly x: number;
  readonly y: number;
  /** 0 far in the past to 1 at the present. */
  readonly depth: number;
  readonly radius: number;
  /** Its place oldest first, for lighting in. */
  readonly order: number;
}

/** One workflow's lane, from deep in the past to the present. */
export interface PlacedLane {
  readonly key: string;
  readonly name: string;
  readonly far: Point;
  readonly near: Point;
  readonly count: number;
  readonly failing: number;
  /** How its newest run stands. */
  readonly newest: RunOutcome;
}

export interface LaneLayout {
  readonly lanes: readonly PlacedLane[];
  /** Oldest first: the order they are drawn, nearer over farther. */
  readonly runs: readonly PlacedRun[];
  /** Where the present is across the screen; every lane ends there. */
  readonly nowX: number;
}

/** How near a lane's newest run sits when it is a month old or more; a run just started sits at 1. */
export const IDLE_DEPTH = 0.6;
/** The farthest back a crowded lane is squeezed to. */
export const CROWD_DEPTH = 0.16;
/** The lanes run back toward a point off the left of the stage, a third of the way down. */
const VANISH = { x: -0.18, y: 0.3 };
/** Room right of the present for each lane's name. */
const LABEL_ROOM_PX = 170;
const LABEL_ROOM_SHARE = 0.3;
const LANE_PAD_PX = 28;
const MAX_LANE_GAP_PX = 130;
/** Lanes sit low in the stage, so the fan opens upward toward the past. */
const LANE_BLOCK_BIAS = 0.65;
/** Ages are read on a log scale in hours, up to a month: the last hours move a lane most. */
const AGE_UNIT_MS = 3_600_000;
const AGE_REACH_MS = 30 * 24 * AGE_UNIT_MS;
/** Runs on a lane sit this far apart at the present, less as they recede. */
const RUN_GAP_PX = 30;
const BASE_RADIUS_PX = 5;
const RADIUS_PER_ROOT_MINUTE = 2.2;
const MAX_RADIUS_PX = 18;
/** A run still going has no length yet: drawn mid-sized. */
const OPEN_RADIUS_PX = 8;
/** However far back, a star stays large enough to see and to flare. */
const MIN_DRAWN_RADIUS_PX = 2;
const SECONDS_PER_MINUTE = 60;

/** A run's size at the present, from how long it took. */
export function runRadius(run: ActionsRun): number {
  if (run.durationS === null) return OPEN_RADIUS_PX;
  const grown =
    BASE_RADIUS_PX + RADIUS_PER_ROOT_MINUTE * Math.sqrt(run.durationS / SECONDS_PER_MINUTE);
  return Math.min(MAX_RADIUS_PX, grown);
}

/** How near a lane's newest run sits, started at `at`: 1 now, IDLE_DEPTH a month ago or more. */
export function frontDepth(at: number, now: number): number {
  const age = Math.log1p(Math.max(0, now - at) / AGE_UNIT_MS);
  const share = Math.min(1, age / Math.log1p(AGE_REACH_MS / AGE_UNIT_MS));
  return 1 - (1 - IDLE_DEPTH) * share;
}

const towards = (from: Point, to: Point, share: number): Point => ({
  x: from.x + (to.x - from.x) * share,
  y: from.y + (to.y - from.y) * share,
});

/** Each lane's end at the present: evenly spaced, no wider apart than reads as one sky. */
function laneEnds(count: number, stage: Stage, nowX: number): Point[] {
  const room = stage.height - LANE_PAD_PX * 2;
  const gap = count > 1 ? Math.min(MAX_LANE_GAP_PX, room / (count - 1)) : 0;
  const first = stage.top + LANE_PAD_PX + (room - gap * (count - 1)) * LANE_BLOCK_BIAS;
  return Array.from({ length: count }, (_, index) => ({ x: nowX, y: first + gap * index }));
}

interface Lane {
  readonly name: string;
  readonly near: Point;
  /** Newest first. */
  readonly runs: readonly ActionsRun[];
}

/**
 * Each workflow as a lane running back from the present toward a vanishing
 * point, its runs as stars along it, newest nearest. A lane's newest run sits
 * back from the present by how long ago it started, so an idle workflow reads
 * as one; the runs behind it follow at even steps, so every run stays apart
 * and visible however many ran on one day.
 */
export function layoutLanes(runs: readonly ActionsRun[], now: number, stage: Stage): LaneLayout {
  const names = [...new Set(runs.map((run) => run.workflow))].sort((a, b) => a.localeCompare(b));
  const nowX = stage.left + stage.width - Math.min(LABEL_ROOM_PX, stage.width * LABEL_ROOM_SHARE);
  const vanish = { x: stage.left + stage.width * VANISH.x, y: stage.top + stage.height * VANISH.y };
  const ends = laneEnds(names.length, stage, nowX);
  const lanes: Lane[] = names.map((name, index) => ({
    name,
    near: ends[index],
    runs: runs.filter((run) => run.workflow === name),
  }));
  const placed = lanes
    .flatMap((lane) => placeOnLane(lane, vanish, now))
    .sort((a, b) => a.run.createdAt - b.run.createdAt)
    .map((run, order) => ({ ...run, order }));
  return { lanes: lanes.map((lane) => placedLane(lane, vanish)), runs: placed, nowX };
}

function placeOnLane(lane: Lane, vanish: Point, now: number): Omit<PlacedRun, 'order'>[] {
  const length = Math.hypot(lane.near.x - vanish.x, lane.near.y - vanish.y);
  const step = 1 - RUN_GAP_PX / Math.max(length, RUN_GAP_PX * 2);
  const newestFirst = [...lane.runs].sort((a, b) => b.createdAt - a.createdAt);
  const front = frontDepth(newestFirst[0].createdAt, now);
  const depths = newestFirst.map((_, index) => front * Math.pow(step, index));
  return newestFirst.map((run, index) => {
    const depth = squeezed(depths, index);
    const at = towards(vanish, lane.near, depth);
    const radius = Math.max(MIN_DRAWN_RADIUS_PX, runRadius(run) * depth);
    return { key: String(run.id), run, x: at.x, y: at.y, depth, radius };
  });
}

/** A lane pushed past CROWD_DEPTH is squeezed evenly back into it, so its oldest runs never pile up. */
function squeezed(depths: readonly number[], index: number): number {
  const [nearest, farthest] = [depths[0], depths[depths.length - 1]];
  if (farthest >= CROWD_DEPTH) return depths[index];
  return nearest - ((nearest - depths[index]) * (nearest - CROWD_DEPTH)) / (nearest - farthest);
}

function placedLane(lane: Lane, vanish: Point): PlacedLane {
  return {
    key: lane.name,
    name: lane.name,
    far: towards(vanish, lane.near, CROWD_DEPTH),
    near: lane.near,
    count: lane.runs.length,
    failing: lane.runs.filter((run) => run.outcome === 'failed').length,
    newest: lane.runs.reduce((a, b) => (b.createdAt > a.createdAt ? b : a)).outcome,
  };
}
