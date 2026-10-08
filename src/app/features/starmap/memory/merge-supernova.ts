/* How a merged pull request leaves: a supernova where its star stood, then the
   streak. Both skies and the sound read the same rule from here. */

/** The supernova's length, then the streak's, in seconds. */
export const NOVA_S = 0.7;
export const STREAK_S = 2.0;
export const MERGE_SPAN_S = NOVA_S + STREAK_S;

/** Warm white-gold, so a merge never reads as `blocked`'s red shockwave. */
export const NOVA_FLASH = '#fff4cf';
export const NOVA_RING = '#ffd36e';

/** The size a departed star is drawn at: it is gone, so there is none to measure. */
export const DEPARTED_MAG = 7;

/** More booms than this in one refresh is mud, so the rest play silent. */
const MAX_BOOMS = 4;
const PAN_REACH = 0.8;

/** How far through the supernova a burst is: null before it and after it. */
export function novaProgress(p: number): number | null {
  const q = (p * MERGE_SPAN_S) / NOVA_S;
  return q > 0 && q < 1 ? q : null;
}

/** How far through the streak a burst is: 0 until the supernova has gone. */
export function streakProgress(p: number): number {
  return Math.min(1, Math.max(0, (p * MERGE_SPAN_S - NOVA_S) / STREAK_S));
}

/** When the boom plays and where it sits between the speakers. */
export interface MergeCue {
  readonly delayS: number;
  /** -1 left to 1 right. */
  readonly pan: number;
}

interface Merge {
  readonly kind: string;
  readonly startAt?: number;
  readonly fromX?: number;
  readonly fromY?: number;
  readonly fromZ?: number;
}

/**
 * The boom for each merge in the news, no more: heard when its supernova
 * starts, from the side of the screen it happens on. Only a merge the diff
 * found has a cue; nothing here runs on a timer or a guess.
 */
export function mergeCues(
  events: readonly Merge[],
  {
    now,
    width,
    toScreen,
  }: {
    now: number;
    width: number;
    toScreen: (x: number, y: number, z: number) => [number, number];
  },
): MergeCue[] {
  return events
    .filter((ev) => ev.kind === 'merged' && ev.startAt != null)
    .slice(0, MAX_BOOMS)
    .map((ev) => {
      const [x] = toScreen(ev.fromX ?? 0, ev.fromY ?? 0, ev.fromZ ?? 0);
      const side = width > 0 ? (x / width) * 2 - 1 : 0;
      return {
        delayS: Math.max(0, (ev.startAt ?? now) - now),
        pan: Math.min(PAN_REACH, Math.max(-PAN_REACH, side)),
      };
    });
}
