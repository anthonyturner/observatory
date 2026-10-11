import {
  Acts,
  CueScene,
  ExitEvent,
  PathStop,
  STREAK_S,
  delayOf,
  firstActProgress,
  fromOf,
  panAt,
  secondActProgress,
  spanOf,
  streakStops,
} from './departure-exit';

/* How a squashed pull request leaves: its star collapses to a point, flashes
   once, then streaks away. A squash folded its commits into one, and the star
   folds in on itself. Both skies and the sound read the same rule from here. */

/** The collapse's length, then the streak's, in seconds. */
export const COLLAPSE_S = 0.9;
export const SQUASH_ACTS: Acts = { firstS: COLLAPSE_S, secondS: STREAK_S };
export const SQUASH_SPAN_S = spanOf(SQUASH_ACTS);

/** Cool blue-white, so a squash reads apart from a merge's warm gold. */
export const COLLAPSE_CORE = '#dff0ff';
export const COLLAPSE_RING = '#7cc4ff';

/** How far through the collapse a burst is: null before it and after it. */
export const collapseProgress = (p: number): number | null => firstActProgress(p, SQUASH_ACTS);

/** How far through the streak a burst is: 0 until the collapse has finished. */
export const squashStreakProgress = (p: number): number => secondActProgress(p, SQUASH_ACTS);

/** The point flashes once, just before the collapse is done, and is gone by its end. */
const FLASH_AT = 0.9;
const FLASH_WIDTH = 0.1;

/**
 * The collapse at `q` through it: radii in star sizes, and opacities. The core
 * and the flash are what a still sky keeps; the ring that falls in is motion.
 */
export function collapseLook(q: number): {
  readonly coreRadius: number;
  readonly coreAlpha: number;
  readonly ringRadius: number;
  readonly ringAlpha: number;
  readonly flashRadius: number;
  readonly flashAlpha: number;
} {
  const flash = Math.max(0, 1 - Math.abs(q - FLASH_AT) / FLASH_WIDTH);
  return {
    // Falling in speeds up, as a collapse does.
    coreRadius: 0.2 + 1.5 * (1 - q * q),
    coreAlpha: 0.55 + 0.45 * q,
    ringRadius: 0.5 + 15 * (1 - q * q),
    ringAlpha: Math.sin(q * Math.PI) * 0.85,
    flashRadius: 0.8 + 1.6 * flash,
    flashAlpha: flash * 0.95,
  };
}

/** The implosion's sound: when it starts, where it sits, and whether the collapse moves. */
export interface ImplosionCue {
  /** Seconds until the collapse starts. */
  readonly delayS: number;
  /** -1 left to 1 right. */
  readonly pan: number;
  /** Whether the collapse is drawn falling in; a still sky keeps only the flash, so only its snap is heard. */
  readonly sweeps: boolean;
  /** The streak's path as the sky draws it; empty when motion is off and there is no streak. */
  readonly whoosh: readonly PathStop[];
}

/** The implosion for a squash: a sweep that rises as the star falls in, a snap as it flashes, then the streak. */
export function implosionCue(ev: ExitEvent, scene: CueScene): ImplosionCue {
  const from = fromOf(ev);
  return {
    delayS: delayOf(ev, scene),
    pan: panAt(scene.project(from.x, from.y, from.z).x, scene.width),
    sweeps: !scene.frozen,
    whoosh: scene.frozen ? [] : streakStops(ev, scene),
  };
}
