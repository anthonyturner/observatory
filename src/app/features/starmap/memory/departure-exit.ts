import { WorldPoint } from '../engine/black-hole';
import { Point, dopplerOf, listenerOf } from '../sound/doppler';
import { COMPANY_S } from './departure-company';
import { Departure } from './departure';

/* What every exit shares. A pull request leaves in two acts: the star's last
   light (a supernova, a collapse, an ember cooling), then it goes (a streak, or
   a sink into the black hole). Each exit's own file says how its acts look and
   sound; this file says when they happen and how a sound is read from them. */

/**
 * Seconds an exit holds before its star begins to go, in front of the first
 * act: room for what orbits the star to play first. Every exit's span, progress
 * and cue reads it, so changing it moves the picture and the sound together.
 * It is as long as the star's company takes to play (`departure-company.ts`).
 */
export const PRELUDE_S = COMPANY_S;

/** The size a departed star is drawn at: it is gone, so there is none to measure. */
export const DEPARTED_MAG = 7;

/** How long an exit's two acts last, in seconds. */
export interface Acts {
  readonly firstS: number;
  readonly secondS: number;
}

/** The moments of an exit that other effects and sounds keep time with, in seconds after it starts. */
export interface Beats {
  /** The star begins to go: the flash, the collapse's first pull, the ember's first cooling. */
  readonly beginS: number;
  /** The first act hands over to the second: the streak leaves, or the ember starts to sink. */
  readonly turnS: number;
  /** The exit has played. */
  readonly endS: number;
}

export const beatsOf = ({ firstS, secondS }: Acts): Beats => ({
  beginS: PRELUDE_S,
  turnS: PRELUDE_S + firstS,
  endS: PRELUDE_S + firstS + secondS,
});

export const spanOf = (acts: Acts): number => beatsOf(acts).endS;

/** How far through the first act `p` (0 to 1 through the whole exit) is: null before it and after it. */
export function firstActProgress(p: number, acts: Acts): number | null {
  const q = (p * spanOf(acts) - PRELUDE_S) / acts.firstS;
  return q > 0 && q < 1 ? q : null;
}

/** How far through the second act `p` is: 0 until the first has gone, 1 once it is over. */
export function secondActProgress(p: number, acts: Acts): number {
  const { turnS } = beatsOf(acts);
  return Math.min(1, Math.max(0, (p * spanOf(acts) - turnS) / acts.secondS));
}

/** The streak a merged or squashed pull request leaves on: its length in seconds. */
export const STREAK_S = 2.0;

/** How far a streak's head travels, in world units, and how much of that it gains toward the viewer in 3D. */
export const STREAK_REACH = 620;
export const STREAK_RISE = 0.32;

/** How far the streak's head has gone at `p` through it: fast away from the star, slowing as it goes. */
export const streakTravel = (p: number): number => STREAK_REACH * (1 - (1 - p) ** 3);

/** Where the streak's head is in the world at `p` through it. */
export function streakHead(from: Point, angle: number, p: number): WorldPoint {
  const travel = streakTravel(p);
  return {
    x: from.x + Math.cos(angle) * travel,
    y: from.y + Math.sin(angle) * travel,
    z: from.z + travel * STREAK_RISE,
  };
}

/** News as an exit's sound reads it: when it starts, and where the star stood. */
export interface ExitEvent {
  readonly kind: string;
  readonly startAt?: number;
  readonly fromX?: number;
  readonly fromY?: number;
  readonly fromZ?: number;
  readonly angle?: number;
  /** How the pull request ended, and what its star carried, where those are known. */
  readonly departure?: Pick<Departure, 'ending'> & Partial<Pick<Departure, 'system'>>;
}

/** The sky a cue is heard against. */
export interface CueScene {
  /** The wall clock, in seconds. */
  readonly now: number;
  readonly width: number;
  readonly height: number;
  /** Motion is off: the sky draws only each exit's first act, so only that is heard. */
  readonly frozen: boolean;
  /** Where a world point is on screen, and how far toward the viewer it stands. */
  readonly project: (x: number, y: number, z: number) => Point;
}

/** Where an exit's star stood. */
export const fromOf = (ev: ExitEvent): WorldPoint => ({
  x: ev.fromX ?? 0,
  y: ev.fromY ?? 0,
  z: ev.fromZ ?? 0,
});

/** The furthest a cue is panned to either side, so nothing plays hard against one speaker. */
const PAN_REACH = 0.8;

/** -1 left to 1 right, from a screen x; centred while the screen has no width. */
export const panAt = (x: number, width: number): number =>
  width > 0 ? Math.min(PAN_REACH, Math.max(-PAN_REACH, (x / width) * 2 - 1)) : 0;

/** Seconds from now until the exit's star begins to go: never behind us. */
export const delayOf = (ev: ExitEvent, scene: CueScene): number =>
  Math.max(0, (ev.startAt ?? scene.now) + PRELUDE_S - scene.now);

/** Where a moving sound sits and how it is pitched, `at` seconds into its path. */
export interface PathStop {
  readonly at: number;
  /** -1 left to 1 right. */
  readonly pan: number;
  /** The Doppler factor of the source's motion over this stretch of the path. */
  readonly doppler: number;
}

/** Stretches a moving sound's path is cut into. */
const PATH_STEPS = 8;

/**
 * The path of a moving source cut into stretches, each panned by where it is and
 * pitched by how fast it closes on the viewer over it, from the positions the
 * sky draws. `place(p)` is the source in the world, `p` from 0 to 1 along it.
 */
export function pathStops(
  place: (p: number) => WorldPoint,
  seconds: number,
  { width, height, project }: Pick<CueScene, 'width' | 'height' | 'project'>,
): PathStop[] {
  const listener = listenerOf(width, height);
  const stepS = seconds / PATH_STEPS;
  const at = (step: number): Point => {
    const world = place(step / PATH_STEPS);
    return project(world.x, world.y, world.z);
  };
  return Array.from({ length: PATH_STEPS }, (_, step) => {
    const start = at(step);
    const end = at(step + 1);
    return {
      at: (step + 0.5) * stepS,
      pan: panAt((start.x + end.x) / 2, width),
      doppler: dopplerOf(start, end, stepS, listener),
    };
  });
}

/** The sound of a streak, along the path the sky draws it on. */
export const streakStops = (ev: ExitEvent, scene: CueScene): PathStop[] =>
  pathStops((p) => streakHead(fromOf(ev), ev.angle ?? 0, p), STREAK_S, scene);
