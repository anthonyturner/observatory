import { Point, dopplerOf, listenerOf } from '../sound/doppler';

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
export function streakProgress(p: number): number {
  return Math.min(1, Math.max(0, (p * MERGE_SPAN_S - NOVA_S) / STREAK_S));
}

/** How far a streak's head travels, in world units, and how much of that it gains toward the viewer in 3D. */
export const STREAK_REACH = 620;
export const STREAK_RISE = 0.32;

/** How far the streak's head has gone at `p` through it: fast away from the star, slowing as it goes. */
export const streakTravel = (p: number): number => STREAK_REACH * (1 - (1 - p) ** 3);

/** Where the streak's head is in the world at `p` through it. */
export function streakHead(
  from: Point,
  angle: number,
  p: number,
): { readonly x: number; readonly y: number; readonly z: number } {
  const travel = streakTravel(p);
  return {
    x: from.x + Math.cos(angle) * travel,
    y: from.y + Math.sin(angle) * travel,
    z: from.z + travel * STREAK_RISE,
  };
}

/** Where the streak's whoosh sits and how it is pitched, `at` seconds into the streak. */
export interface WhooshPoint {
  readonly at: number;
  /** -1 left to 1 right. */
  readonly pan: number;
  /** The Doppler factor of the head's motion over this stretch of the path. */
  readonly doppler: number;
}

/** When the boom plays and where it sits between the speakers. */
export interface MergeCue {
  readonly delayS: number;
  /** -1 left to 1 right. */
  readonly pan: number;
  /** The streak's path as the sky draws it; empty when motion is off and there is no streak. */
  readonly whoosh: readonly WhooshPoint[];
}

interface Merge {
  readonly kind: string;
  readonly startAt?: number;
  readonly fromX?: number;
  readonly fromY?: number;
  readonly fromZ?: number;
  readonly angle?: number;
}

/** Stretches of the streak's path the whoosh is pitched and panned over. */
const WHOOSH_STEPS = 8;

const panAt = (x: number, width: number): number =>
  width > 0 ? Math.min(PAN_REACH, Math.max(-PAN_REACH, (x / width) * 2 - 1)) : 0;

/**
 * The boom for each merge in the news, no more: heard when its supernova
 * starts, from the side of the screen it happens on, and the whoosh that
 * follows it along the streak's own path. Only a merge the diff found has a
 * cue; nothing here runs on a timer or a guess.
 */
export function mergeCues(
  events: readonly Merge[],
  {
    now,
    width,
    height,
    frozen,
    project,
  }: {
    now: number;
    width: number;
    height: number;
    /** Motion is off: the sky draws no streak, so there is no whoosh. */
    frozen: boolean;
    /** Where a world point is on screen, and how far toward the viewer it stands. */
    project: (x: number, y: number, z: number) => Point;
  },
): MergeCue[] {
  const listener = listenerOf(width, height);
  return events
    .filter((ev) => ev.kind === 'merged' && ev.startAt != null)
    .slice(0, MAX_BOOMS)
    .map((ev) => {
      const from = { x: ev.fromX ?? 0, y: ev.fromY ?? 0, z: ev.fromZ ?? 0 };
      return {
        delayS: Math.max(0, (ev.startAt ?? now) - now),
        pan: panAt(project(from.x, from.y, from.z).x, width),
        whoosh: frozen ? [] : whooshOf(from, ev.angle ?? 0, width, listener, project),
      };
    });
}

/** The streak's path cut into stretches, each pitched by how fast the head closes on the viewer over it. */
function whooshOf(
  from: Point,
  angle: number,
  width: number,
  listener: Point,
  project: (x: number, y: number, z: number) => Point,
): WhooshPoint[] {
  const stepS = STREAK_S / WHOOSH_STEPS;
  const at = (step: number): Point => {
    const head = streakHead(from, angle, step / WHOOSH_STEPS);
    return project(head.x, head.y, head.z);
  };
  return Array.from({ length: WHOOSH_STEPS }, (_, step) => {
    const start = at(step);
    const end = at(step + 1);
    return {
      at: (step + 0.5) * stepS,
      pan: panAt((start.x + end.x) / 2, width),
      doppler: dopplerOf(start, end, stepS, listener),
    };
  });
}
