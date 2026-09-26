import { floorHorizon } from './floor-grid';

/** One ring of the wave that rolls across the floor when new data arrives. */
export interface RippleRing {
  /** 0 at the core to 1 at the floor's edge. */
  readonly spread: number;
  readonly alpha: number;
}

/** How long one ring takes to roll out, and when each ring starts after the data lands. */
const RING_S = 2.6;
const RING_DELAYS_S = [0, 0.45] as const;
const RING_ALPHA = 0.7;
/** The floor brightens as the wave passes, by this much at its start. */
const FLOOR_LIFT = 0.8;

/** The rings in flight `sinceRefresh` seconds after new data arrived. None
 *  with motion off, before any data, or once the wave has passed. */
export function rippleRings(sinceRefresh: number | null, isStill: boolean): RippleRing[] {
  if (isStill || sinceRefresh === null) return [];
  return RING_DELAYS_S.map((delay) => (sinceRefresh - delay) / RING_S)
    .filter((spread) => spread >= 0 && spread <= 1)
    .map((spread) => ({ spread, alpha: RING_ALPHA * Math.pow(1 - spread, 1.5) }));
}

/** How much brighter the floor draws while the wave passes: 1 when it is gone. */
export function floorLift(sinceRefresh: number | null, isStill: boolean): number {
  if (isStill || sinceRefresh === null || sinceRefresh < 0) return 1;
  const left = 1 - sinceRefresh / (RING_S + RING_DELAYS_S[RING_DELAYS_S.length - 1]);
  return left <= 0 ? 1 : 1 + FLOOR_LIFT * left * left;
}

/** A ring as drawn: the lower half of an ellipse about the point under the
 *  core, in pixels about the core's centre, y down. */
export interface RippleEllipse {
  readonly centreY: number;
  readonly radiusX: number;
  readonly radiusY: number;
  readonly alpha: number;
}

/** The floor runs past the window's sides, so the wave does too. */
const WIDTH_REACH = 1.1;

/** Lays the rings out on a floor under a core of `coreRadius` that runs
 *  `depth` pixels down and across a window `width` wide. */
export function rippleEllipses(
  rings: readonly RippleRing[],
  floor: { coreRadius: number; depth: number; width: number },
): RippleEllipse[] {
  const horizon = floorHorizon(floor.coreRadius);
  return rings.map((ring) => ({
    centreY: horizon,
    radiusX: ring.spread * (floor.width / 2) * WIDTH_REACH,
    radiusY: ring.spread * (floor.depth - horizon),
    alpha: ring.alpha,
  }));
}
