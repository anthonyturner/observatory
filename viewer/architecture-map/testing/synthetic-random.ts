/** A small deterministic random source, so a synthetic map is the same on every run. */
export function randomFrom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state);
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

export const pick = <T>(items: readonly T[], rand: () => number): T | undefined =>
  items[Math.floor(rand() * items.length)];
