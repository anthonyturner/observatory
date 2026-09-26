const STEP = 0x6d2b79f5;

/** A seeded generator (mulberry32): the same seed gives the same sky on every load. */
export function seededRandom(seed: number): () => number {
  let state = (seed + STEP) >>> 0;
  return () => {
    state = (state + STEP) >>> 0;
    let x = Math.imul(state ^ (state >>> 15), 1 | state);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

/** The seed whose generator carries on where `seededRandom(seed)` stands after
 *  `draws` draws: its state only ever advances by one step per draw. */
export const continuedSeed = (seed: number, draws: number): number => (seed + STEP * draws) >>> 0;
