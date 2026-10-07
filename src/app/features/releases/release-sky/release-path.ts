/** The part of the screen the trajectory runs through, in CSS pixels. */
export interface Stage {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

/** A point on the trajectory: where it is, which way it runs, and how near it is. */
export interface PathPoint {
  readonly x: number;
  readonly y: number;
  /** A unit vector along the path, toward the present. */
  readonly dx: number;
  readonly dy: number;
  /** 0 far away in the past to 1 at the leading edge. */
  readonly depth: number;
}

/**
 * The trajectory's control points as shares of the stage: it rises out of
 * the distance at the upper left, swings down through the middle and climbs
 * toward the viewer on the right, so the newest work sits at the leading edge.
 */
const P0 = { x: 0.03, y: 0.36 };
const P1 = { x: 0.34, y: 0.02 };
const P2 = { x: 0.56, y: 1.02 };
const P3 = { x: 0.97, y: 0.5 };
/** How near the far end of the path is, as a share of the near end. */
export const FAR_DEPTH = 0.42;

const bezier = (t: number, a: number, b: number, c: number, d: number): number => {
  const u = 1 - t;
  return u * u * u * a + 3 * u * u * t * b + 3 * u * t * t * c + t * t * t * d;
};

const slope = (t: number, a: number, b: number, c: number, d: number): number => {
  const u = 1 - t;
  return 3 * u * u * (b - a) + 6 * u * t * (c - b) + 3 * t * t * (d - c);
};

/** The trajectory at `t`, from 0 (the far past) to 1 (the leading edge). */
export function pathAt(t: number, stage: Stage): PathPoint {
  const x = stage.left + bezier(t, P0.x, P1.x, P2.x, P3.x) * stage.width;
  const y = stage.top + bezier(t, P0.y, P1.y, P2.y, P3.y) * stage.height;
  const sx = slope(t, P0.x, P1.x, P2.x, P3.x) * stage.width;
  const sy = slope(t, P0.y, P1.y, P2.y, P3.y) * stage.height;
  const length = Math.hypot(sx, sy) || 1;
  return { x, y, dx: sx / length, dy: sy / length, depth: FAR_DEPTH + (1 - FAR_DEPTH) * t };
}

/** Enough samples that a step along the path is a few pixels at most. */
const ARC_SAMPLES = 240;

/** The path between two points measured on screen: how long it is, and where a share of that length falls. */
export interface PathRuler {
  readonly length: number;
  /** The `t` a share of the length in from the start sits at. */
  tAt(share: number): number;
}

/**
 * The path between the ends of `range` measured on screen, so things placed at even
 * shares of its length sit evenly, which even steps in `t` do not: the curve
 * runs faster through some stretches than others.
 */
export function alongPath(range: readonly [number, number], stage: Stage): PathRuler {
  const [from, to] = range;
  const lengths = [0];
  let previous = pathAt(from, stage);
  for (let sample = 1; sample <= ARC_SAMPLES; sample++) {
    const point = pathAt(from + ((to - from) * sample) / ARC_SAMPLES, stage);
    lengths.push(lengths[sample - 1] + Math.hypot(point.x - previous.x, point.y - previous.y));
    previous = point;
  }
  const length = lengths[ARC_SAMPLES];
  const tAt = (share: number): number => {
    const target = Math.min(Math.max(share, 0), 1) * length;
    const after = lengths.findIndex((each) => each >= target);
    if (after <= 0) return from;
    const span = lengths[after] - lengths[after - 1];
    const fraction = span > 0 ? (target - lengths[after - 1]) / span : 0;
    return from + ((to - from) * (after - 1 + fraction)) / ARC_SAMPLES;
  };
  return { length, tAt };
}
