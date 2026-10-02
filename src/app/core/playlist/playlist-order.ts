/** The track after `index`, back to the first after the last. */
export const nextIndex = (index: number, length: number): number => (index + 1) % length;

/** The track before `index`, round to the last before the first. */
export const previousIndex = (index: number, length: number): number =>
  (index - 1 + length) % length;
