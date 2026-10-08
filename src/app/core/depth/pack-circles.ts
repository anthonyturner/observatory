export interface Spot {
  readonly x: number;
  readonly y: number;
}

interface PlacedCircle extends Spot {
  readonly r: number;
}

const TAU = Math.PI * 2;
/** The ring spacing and the spacing along a ring: a third of the circle being placed, never finer than this. */
const SMALLEST_STEP = 1.5;
const STEPS_PER_RADIUS = 3;
/** A turn the golden ratio leaves between rings, so candidates on neighbouring rings do not line up in spokes. */
const RING_TURN = TAU * 0.381966;
const ORIGIN: Spot = { x: 0, y: 0 };

const clears = (placed: readonly PlacedCircle[], at: Spot, r: number, gap: number): boolean =>
  placed.every((other) => Math.hypot(other.x - at.x, other.y - at.y) >= other.r + r + gap);

/** The nearest ring of candidate spots, searching outwards from the origin, where a circle of radius `r` touches nothing placed. */
function freeSpot(placed: readonly PlacedCircle[], r: number, gap: number): Spot {
  if (!placed.length) return ORIGIN;
  const step = Math.max(SMALLEST_STEP, r / STEPS_PER_RADIUS);
  for (let ring = 1; ; ring++) {
    const radius = ring * step;
    const count = Math.ceil((TAU * radius) / step);
    for (let k = 0; k < count; k++) {
      const angle = (k / count) * TAU + ring * RING_TURN;
      const at = { x: radius * Math.cos(angle), y: radius * Math.sin(angle) };
      if (clears(placed, at, r, gap)) return at;
    }
  }
}

/**
 * Where to put circles of the given radii so that none overlaps another and
 * each is `gap` clear: the largest at the origin, the rest spiralling out
 * round it into the nearest free place. Spots come back in the order of
 * `radii`; equal radii keep their order, so the same input packs the same way.
 */
export function packCircles(radii: readonly number[], gap: number): Spot[] {
  const largestFirst = radii.map((_, index) => index).sort((a, b) => radii[b] - radii[a] || a - b);
  const placed: PlacedCircle[] = [];
  const spots = new Array<Spot>(radii.length);
  for (const index of largestFirst) {
    const r = radii[index];
    const spot = freeSpot(placed, r, gap);
    placed.push({ ...spot, r });
    spots[index] = spot;
  }
  return spots;
}
