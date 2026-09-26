export const clamp01 = (x: number): number => (x <= 0 ? 0 : x >= 1 ? 1 : x);

/** Fast out, slow in: how the core and its beads grow on load. */
export const easeOut = (x: number): number => 1 - Math.pow(1 - clamp01(x), 3);
