import { plural } from '../../../shared/text/plural';
import { OUTCOME_WORDS, agoWords, eventWords, tookWords } from '../actions-words';
import { LaneLayout, PlacedLane, PlacedRun } from './run-lanes';
import { outcomeColour } from './run-look';

/** A run's star as a button over the canvas, so it can be hovered, focused and picked. */
export interface RunMark {
  readonly key: string;
  readonly x: number;
  readonly y: number;
  /** The button's width and height, never smaller than a fingertip. */
  readonly hit: number;
  /** Shown on hover and focus. */
  readonly tip: string;
  /** What a screen reader says for it. */
  readonly spoken: string;
}

/** A workflow's name at the present end of its lane. */
export interface LaneMark {
  readonly key: string;
  readonly x: number;
  readonly y: number;
  readonly name: string;
  readonly count: string;
  /** The name's dot, coloured as its newest run is: a CSS colour. */
  readonly colour: string;
}

/** Lanes closer together than this show their names only, so the labels never overlap. */
const COMPACT_LANE_GAP_PX = 34;

export interface RunMarks {
  /** Oldest first: the order Tab takes, as along a timeline. */
  readonly runs: readonly RunMark[];
  readonly lanes: readonly LaneMark[];
  /** The lanes are too close for a second line under each name. */
  readonly isCompact: boolean;
  /** The present's label, above the top lane; null with no lanes. */
  readonly now: { readonly x: number; readonly y: number } | null;
}

const MIN_HIT_PX = 24;
const HIT_PER_RADIUS = 2.6;
const LANE_LABEL_GAP_PX = 18;
const NOW_LABEL_RISE_PX = 44;

function runMark(placed: PlacedRun, now: number): RunMark {
  const { run } = placed;
  const outcome = OUTCOME_WORDS[run.outcome];
  const flaky = run.isFlaky ? ' · flaky' : '';
  const ago = agoWords(run.createdAt, now);
  const took = tookWords(run.durationS, run.outcome);
  return {
    key: placed.key,
    x: placed.x,
    y: placed.y,
    hit: Math.max(MIN_HIT_PX, placed.radius * HIT_PER_RADIUS),
    tip: `${run.workflow} #${run.number} · ${outcome}${flaky} · ${run.branch} · ${took} · ${ago}`,
    spoken:
      `${run.workflow} run ${run.number}, ${outcome.toLowerCase()}${run.isFlaky ? ', flaky' : ''}: ` +
      `${run.title}. ${run.branch}, ${eventWords(run.event)} by ${run.actor || 'unknown'}, ${took}, ${ago}`,
  };
}

function laneMark(lane: PlacedLane): LaneMark {
  const failing = lane.failing ? ` · ${lane.failing} failed` : '';
  return {
    key: lane.key,
    x: lane.near.x + LANE_LABEL_GAP_PX,
    y: lane.near.y,
    name: lane.name,
    count: `${plural(lane.count, 'run')}${failing}`,
    colour: outcomeColour(lane.newest),
  };
}

/** The buttons and names the sky lays over its canvas, `now` being when the report was made. */
export function runMarks(layout: LaneLayout, now: number): RunMarks {
  const [top, next] = layout.lanes;
  return {
    runs: layout.runs.map((run) => runMark(run, now)),
    lanes: layout.lanes.map(laneMark),
    isCompact: next !== undefined && next.near.y - top.near.y < COMPACT_LANE_GAP_PX,
    now: top ? { x: layout.nowX, y: top.near.y - NOW_LABEL_RISE_PX } : null,
  };
}
