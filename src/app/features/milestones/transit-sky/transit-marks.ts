import { dueColour } from '../milestone-look';
import { dueWords, milestoneSpoken, progressWords } from '../milestone-words';
import { PlacedMilestone, TransitLayout } from './transit-lanes';

/** A milestone's planet as a link over the canvas, so it can be hovered, focused and followed. */
export interface PlanetMark {
  readonly key: string;
  readonly x: number;
  readonly y: number;
  /** The link's width and height, never smaller than a fingertip. */
  readonly hit: number;
  readonly href: string;
  readonly tip: string;
  readonly spoken: string;
}

/** A lane's words: its milestone and progress under its launch end, its date under its arrival. */
export interface LaneMark {
  readonly key: string;
  readonly startX: number;
  readonly endX: number;
  readonly y: number;
  readonly title: string;
  /** "7 of 12 done". */
  readonly progress: string;
  readonly due: string;
  /** The date's dot, coloured as the planet's air: a CSS colour. */
  readonly colour: string;
}

export interface TransitMarks {
  /** Soonest due first: the order Tab takes. */
  readonly planets: readonly PlanetMark[];
  readonly lanes: readonly LaneMark[];
}

const MIN_HIT_PX = 24;
const HIT_PER_RADIUS = 2.4;
/** The words sit this far under the lane. */
const LABEL_DROP_PX = 10;

function planetMark(lane: PlacedMilestone, now: number): PlanetMark {
  const { milestone } = lane;
  return {
    key: lane.key,
    x: lane.x,
    y: lane.y,
    hit: Math.max(MIN_HIT_PX, lane.radius * HIT_PER_RADIUS),
    href: milestone.url,
    tip: `${milestone.title} · ${progressWords(milestone)} · ${dueWords(milestone, now)}`,
    spoken: milestoneSpoken(milestone, now),
  };
}

function laneMark(lane: PlacedMilestone, now: number): LaneMark {
  return {
    key: lane.key,
    startX: lane.from.x,
    endX: lane.to.x,
    y: lane.from.y + LABEL_DROP_PX,
    title: lane.milestone.title,
    progress: progressWords(lane.milestone),
    due: dueWords(lane.milestone, now),
    colour: dueColour(lane.state),
  };
}

/** The links and words the sky lays over its canvas, `now` being when the report was made. */
export function transitMarks(layout: TransitLayout, now: number): TransitMarks {
  return {
    planets: layout.lanes.map((lane) => planetMark(lane, now)),
    lanes: layout.lanes.map((lane) => laneMark(lane, now)),
  };
}
