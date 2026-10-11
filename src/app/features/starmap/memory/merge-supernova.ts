import {
  Acts,
  CueScene,
  ExitEvent,
  PathStop,
  delayOf,
  firstActProgress,
  fromOf,
  panAt,
  secondActProgress,
  spanOf,
  STREAK_S,
  streakStops,
} from './departure-exit';

/* How a merged pull request leaves: a supernova where its star stood, then the
   streak. Both skies and the sound read the same rule from here. */

/** The supernova's length, then the streak's, in seconds. */
export const NOVA_S = 0.7;
export const MERGE_ACTS: Acts = { firstS: NOVA_S, secondS: STREAK_S };
export const MERGE_SPAN_S = spanOf(MERGE_ACTS);

/** Warm white-gold, so a merge never reads as `blocked`'s red shockwave. */
export const NOVA_FLASH = '#fff4cf';
export const NOVA_RING = '#ffd36e';

/** How far through the supernova a burst is: null before it and after it. */
export const novaProgress = (p: number): number | null => firstActProgress(p, MERGE_ACTS);

/** The flash and the ring at `q` through the supernova: radii in star sizes, and opacities. */
export function novaLook(q: number): {
  readonly flashRadius: number;
  readonly flashAlpha: number;
  readonly ringRadius: number;
  readonly ringAlpha: number;
} {
  return {
    flashRadius: 1.5 + q * 3,
    flashAlpha: (1 - q) ** 2 * 0.9,
    ringRadius: 1.5 + (1 - (1 - q) ** 3) * 16,
    ringAlpha: (1 - q) * 0.85,
  };
}

/** How far through the streak a burst is: 0 until the supernova has gone. */
export const streakProgress = (p: number): number => secondActProgress(p, MERGE_ACTS);

/** When the boom plays and where it sits between the speakers. */
export interface MergeCue {
  /** Seconds until the supernova starts. */
  readonly delayS: number;
  /** -1 left to 1 right. */
  readonly pan: number;
  /** The streak's path as the sky draws it; empty when motion is off and there is no streak. */
  readonly whoosh: readonly PathStop[];
}

/** The boom for a merge, heard when its supernova starts and from the side of the screen it happens on. */
export function mergeCue(ev: ExitEvent, scene: CueScene): MergeCue {
  const from = fromOf(ev);
  return {
    delayS: delayOf(ev, scene),
    pan: panAt(scene.project(from.x, from.y, from.z).x, scene.width),
    whoosh: scene.frozen ? [] : streakStops(ev, scene),
  };
}
