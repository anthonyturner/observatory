/** Dashes in the voice level line. */
export const LEVEL_DASHES = 36;

/** How much fuller the middle dash is than the ends: 1.3 leaves the ends at a
 *  third of the middle's height. */
const MIDDLE_BIAS = 1.3;
/** A fixed, repeating unevenness, so the line reads as a voice, not a bar. */
const UNEVEN_STEPS = 5;
const UNEVEN_BASE = 0.8;
const UNEVEN_SPREAD = 0.5;

/** Each dash's share of the level: fullest in the middle, a little uneven. */
export function levelWeights(count = LEVEL_DASHES): number[] {
  return Array.from({ length: count }, (_, index) => {
    const middle = 1 - Math.abs(index / (count - 1) - 0.5) * MIDDLE_BIAS;
    const uneven =
      UNEVEN_BASE + UNEVEN_SPREAD * (((index * 7) % UNEVEN_STEPS) / (UNEVEN_STEPS - 1));
    return Math.round(middle * uneven * 100) / 100;
  });
}
