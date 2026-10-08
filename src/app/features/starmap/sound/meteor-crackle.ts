import { rnd } from '../engine/rnd';

/** One tick of the crackle: a breath of high-passed noise. */
export interface CracklePop {
  /** Seconds after the landing. */
  readonly at: number;
  readonly freq: number;
  readonly decay: number;
  readonly level: number;
}

/** The crackle's length, and how quiet its loudest pop is at full strength. */
const SPREAD_S = 0.32;
const LOUDEST = 0.03;

/**
 * The sizzle of a landing: a bigger change crackles in more pops, each softer
 * than the one before, so it reads as embers dying. Seeded by the pull
 * request, so the same landing always sounds the same.
 */
export function crackleOf(strength: number, seed: number): CracklePop[] {
  const random = rnd(seed * 7919 + 3);
  const count = 3 + Math.round(strength * 4);
  return Array.from({ length: count }, (_, i) => {
    const along = i / count;
    return {
      at: along * SPREAD_S + random() * 0.04,
      freq: 3500 + random() * 5000,
      decay: 0.02 + random() * 0.04,
      level: LOUDEST * (0.4 + 0.6 * strength) * (1 - along * 0.7),
    };
  });
}
