import {
  DueState,
  Milestone,
  dueStateOf,
  progressOf,
} from '../../../core/milestones/milestones-report';
import { Stage } from '../../releases/release-sky/release-path';

export interface Point {
  readonly x: number;
  readonly y: number;
}

/** One open milestone's lane, launch on the left to arrival on the right, and its planet on it. */
export interface PlacedMilestone {
  readonly key: string;
  readonly milestone: Milestone;
  readonly state: DueState;
  /** 0 to 1: how far along its lane the planet has come. */
  readonly progress: number;
  readonly from: Point;
  readonly to: Point;
  /** How far the lane's middle rises above its ends. */
  readonly bow: number;
  /** The planet. */
  readonly x: number;
  readonly y: number;
  readonly radius: number;
}

export interface TransitLayout {
  /** Soonest due at the top. */
  readonly lanes: readonly PlacedMilestone[];
  /** Open milestones past the sky's room, which only the list shows. */
  readonly hidden: number;
}

/** Past this many lanes they crowd; the list holds the rest. */
export const MAX_LANES = 8;
/** No two lanes further apart than this, so a few milestones stay a group. */
const MAX_GAP_PX = 130;
/** The lanes run no wider than this, centred, so a planet's progress reads on a wide screen. */
const MAX_LANE_PX = 1100;
/** Room at each end for the arrival's ring and the planet's halo. */
const END_MARGIN_PX = 36;
const BOW_SHARE = 0.28;
const MAX_BOW_PX = 30;
/** A planet's size follows how much is on the milestone: `6 + 2.2 × √items` px, at most 20. */
const PLANET_BASE_PX = 6;
const PLANET_GROWTH_PX = 2.2;
const MAX_PLANET_PX = 20;
/** A planet never takes more than this share of the gap to the next lane. */
const PLANET_GAP_SHARE = 0.3;

export const EMPTY_TRANSIT: TransitLayout = { lanes: [], hidden: 0 };

/** A planet's radius for a milestone with `items` issues and pull requests on it. */
export const planetRadius = (items: number): number =>
  Math.min(MAX_PLANET_PX, PLANET_BASE_PX + PLANET_GROWTH_PX * Math.sqrt(items));

/** The point `t` (0 to 1) along a lane: a gentle arc rising `bow` at its middle. */
export function pointAlong(lane: Pick<PlacedMilestone, 'from' | 'to' | 'bow'>, t: number): Point {
  const { from, to, bow } = lane;
  const control = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 - bow * 2 };
  const a = (1 - t) ** 2;
  const b = 2 * (1 - t) * t;
  const c = t ** 2;
  return {
    x: a * from.x + b * control.x + c * to.x,
    y: a * from.y + b * control.y + c * to.y,
  };
}

/** What every lane shares: the span they run across, the gap between them, and the time. */
interface LaneFrame {
  readonly span: Stage;
  readonly gap: number;
  readonly now: number;
}

function laneOf(milestone: Milestone, y: number, frame: LaneFrame): PlacedMilestone {
  const { span, gap, now } = frame;
  const from = { x: span.left + END_MARGIN_PX, y };
  const to = { x: span.left + span.width - END_MARGIN_PX, y };
  const bow = Math.min(MAX_BOW_PX, gap * BOW_SHARE);
  const progress = progressOf(milestone);
  const planet = pointAlong({ from, to, bow }, progress);
  const items = milestone.open + milestone.closed;
  return {
    key: String(milestone.number),
    milestone,
    state: dueStateOf(milestone, now),
    progress,
    from,
    to,
    bow,
    x: planet.x,
    y: planet.y,
    radius: Math.min(planetRadius(items), gap * PLANET_GAP_SHARE),
  };
}

/**
 * Where each open milestone's lane and planet go on `stage`, soonest due at
 * the top, `now` being when the report was made: each a lane of its own, its
 * planet as far along it as the milestone is done.
 */
export function layoutTransit(
  open: readonly Milestone[],
  stage: Stage,
  now: number,
): TransitLayout {
  if (!open.length || stage.width <= 0 || stage.height <= 0) return EMPTY_TRANSIT;
  const shown = open.slice(0, MAX_LANES);
  const gap = Math.min(MAX_GAP_PX, stage.height / shown.length);
  const width = Math.min(MAX_LANE_PX, stage.width);
  const span: Stage = { ...stage, left: stage.left + (stage.width - width) / 2, width };
  const top = stage.top + (stage.height - gap * shown.length) / 2 + gap / 2;
  const frame: LaneFrame = { span, gap, now };
  return {
    lanes: shown.map((milestone, index) => laneOf(milestone, top + gap * index, frame)),
    hidden: open.length - shown.length,
  };
}
