import { clamp01 } from './easing';
import { BALL } from './proportions';

/** Floor segments of like brightness, stroked together: a canvas path carries one alpha. */
export interface FloorBatch {
  readonly alpha: number;
  /** x1, y1, x2, y2 per segment, in pixels about the core's centre. */
  readonly segments: Float32Array;
}

export interface FloorGrid {
  readonly key: string;
  readonly batches: readonly FloorBatch[];
}

export interface FloorSize {
  readonly coreRadius: number;
  readonly windowWidth: number;
  /** From the core's centre down to where the floor ends. */
  readonly depth: number;
}

/** Rows start this far along the ground; nearer ones would fall off the screen. */
const ROWS_FROM = 8;
/** The grid stops a few pixels short of the horizon, where it is all fade. */
const ROWS_TO = ROWS_FROM / 0.03;
const BRIGHTEST = 0.45;
const LEVELS = 6;
const COLUMN_STEPS = 8;
const ROW_STEPS = 16;
/** Columns end where their neighbours close to this many pixels apart. */
const COLUMN_MIN_GAP = 4;
/** Past this spacing only some rows are kept, or they would merge into one band. */
const ROW_MIN_GAP = 3;
const OVERHANG = 1.1;
const INVISIBLE = 0.002;

interface Plane {
  readonly horizon: number;
  readonly drop: number;
  readonly halfWidth: number;
}

interface Segment {
  readonly from: readonly [number, number];
  readonly to: readonly [number, number];
  readonly alpha: number;
}

export const floorKey = ({ coreRadius, windowWidth, depth }: FloorSize): string =>
  `${Math.round(coreRadius)}|${windowWidth}|${depth}`;

/** A grid on a ground plane under the ball, with its own perspective, so the
 *  horizon sits just under the ball. Rows bunch toward the horizon; lines fade
 *  toward it, toward the page's sides and a little at the bottom edge. The
 *  segments are short so each end can carry its own fade. */
export function buildFloorGrid(size: FloorSize): FloorGrid {
  const horizon = size.coreRadius * BALL * 0.85;
  const plane: Plane = { horizon, drop: size.depth - horizon, halfWidth: size.windowWidth / 2 };
  const segments = [...columns(plane), ...rows(plane)].filter((s) => s.alpha > INVISIBLE);
  return { key: floorKey(size), batches: batch(segments) };
}

function fadeAt(plane: Plane, [x, y]: readonly [number, number]): number {
  const down = (y - plane.horizon) / plane.drop;
  const far = Math.pow(clamp01(down * 3), 2.2);
  // Brightest just under the ball, faint by the bottom edge where the cards sit over it.
  const edge = 1 - 0.85 * clamp01((down - 0.25) / 0.6);
  const side = 1 - clamp01((Math.abs(x) / plane.halfWidth - 0.3) / 0.7);
  return BRIGHTEST * far * side * side * edge;
}

function segment(
  plane: Plane,
  from: readonly [number, number],
  to: readonly [number, number],
): Segment {
  return { from, to, alpha: (fadeAt(plane, from) + fadeAt(plane, to)) / 2 };
}

/** Ground depth z puts column X at X·drop/z across. The floor runs on past the
 *  window's sides, so the outer columns only come into view further off. */
function columns(plane: Plane): Segment[] {
  const wide = plane.halfWidth * OVERHANG;
  const zStop = plane.drop / COLUMN_MIN_GAP;
  const count = Math.ceil((wide * zStop) / plane.drop);
  const out: Segment[] = [];
  for (let column = -count; column <= count; column++) {
    const zIn = Math.max(ROWS_FROM, (Math.abs(column) * plane.drop) / wide);
    if (zIn >= zStop) continue;
    // Even steps down the screen, not along the ground, so the fade near the
    // horizon gets as many ends as the part near the viewer.
    const at = (u: number): [number, number] => {
      const z = 1 / ((1 - u) / zIn + u / zStop);
      return [(column * plane.drop) / z, plane.horizon + (plane.drop * ROWS_FROM) / z];
    };
    for (let k = 0; k < COLUMN_STEPS; k++) {
      out.push(segment(plane, at(k / COLUMN_STEPS), at((k + 1) / COLUMN_STEPS)));
    }
  }
  return out;
}

/** Ground depth z puts a row at horizon + drop·ROWS_FROM/z down the screen. */
function rows(plane: Plane): Segment[] {
  const wide = plane.halfWidth * OVERHANG;
  const spread = plane.drop * ROWS_FROM;
  const xAt = (k: number): number => -wide + (2 * wide * k) / ROW_STEPS;
  const out: Segment[] = [];
  for (
    let z = ROWS_FROM;
    z <= ROWS_TO;
    z += Math.max(1, Math.round((z * z * ROW_MIN_GAP) / spread))
  ) {
    const y = plane.horizon + spread / z;
    for (let k = 0; k < ROW_STEPS; k++) out.push(segment(plane, [xAt(k), y], [xAt(k + 1), y]));
  }
  return out;
}

function batch(segments: readonly Segment[]): FloorBatch[] {
  const top = segments.reduce((max, s) => Math.max(max, s.alpha), 0) || 1;
  const levels = Array.from({ length: LEVELS }, (): number[] => []);
  for (const { from, to, alpha } of segments) {
    levels[Math.min(LEVELS - 1, Math.floor((alpha / top) * LEVELS))].push(...from, ...to);
  }
  return levels
    .map((coords, level) => ({
      alpha: ((level + 0.5) / LEVELS) * top,
      segments: Float32Array.from(coords),
    }))
    .filter((level) => level.segments.length > 0);
}
