import { WORLD } from './sky-model';

/** The black hole sits at the centre of the world the queue is laid out in. */
export const HOLE = { x: WORLD.w / 2, y: WORLD.h / 2 } as const;

/** No star, falling or not, sits inside this: the hole's shadow and disc need the room. */
export const HOLE_CLEAR = 150;
/** The closest a falling star comes, in world units, so it never disappears. */
export const FALL_FLOOR = 240;
/** Days past the threshold for the pull to reach about two thirds of its full strength. */
const FALL_DAYS = 21;
/** The share of the way to the floor a star travels at full pull. */
const MAX_FALL = 0.75;
/** How far round the hole, in radians, a star turns on its way in. */
const SWIRL = 0.9;
/** At full pull a star's colour is this much the hole's red, so its bucket still reads. */
const MAX_REDDEN = 0.3;
const RED = [255, 48, 32] as const;

/** A point in the sky's world. */
export interface WorldPoint {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/** Whether a pull request idle this long is past the threshold. */
export const isFalling = (idleDays: number, staleAfterDays: number): boolean =>
  idleDays > staleAfterDays;

/** 0 up to the threshold, then rising toward 1 the longer it stays idle. */
export function fallOf(idleDays: number, staleAfterDays: number): number {
  if (!isFalling(idleDays, staleAfterDays)) return 0;
  return 1 - Math.exp(-(idleDays - staleAfterDays) / FALL_DAYS);
}

/**
 * Where a star laid out at `home` sits under a pull of `pull`: drawn in and
 * turned about the hole, so a growing pull traces a spiral, never closer than
 * the floor. Every star is kept clear of the hole itself.
 */
export function placeByHole(home: WorldPoint, pull: number): WorldPoint {
  const from = Math.hypot(home.x - HOLE.x, home.y - HOLE.y);
  if (pull <= 0 && from >= HOLE_CLEAR) return home;
  const angle = Math.atan2(home.y - HOLE.y, home.x - HOLE.x) + SWIRL * pull;
  const reach = Math.max(from - FALL_FLOOR, 0) * MAX_FALL * pull;
  const radius = Math.max(from - reach, HOLE_CLEAR);
  return {
    x: HOLE.x + Math.cos(angle) * radius,
    y: HOLE.y + Math.sin(angle) * radius,
    z: home.z * (1 - MAX_FALL * pull),
  };
}

/** The least room a fallen star keeps from any other, in world units. */
export const FALLEN_GAP = 80;
const SEPARATION_PASSES = 4;

/**
 * Nudges fallen stars off any star they landed on, so two pulled in along the
 * same line both stay in view: of a crowded pair, the one pulled harder gives
 * way, straight away from the other, and never past the floor.
 */
export function keepApart<T extends { x: number; y: number }>(
  points: readonly T[],
  pullOf: (point: T) => number,
): void {
  for (let pass = 0; pass < SEPARATION_PASSES; pass++) {
    points.forEach((a, i) => {
      for (const b of points.slice(i + 1)) {
        const [mover, other] = pullOf(b) >= pullOf(a) ? [b, a] : [a, b];
        if (pullOf(mover) > 0) giveWay(mover, other);
      }
    });
  }
}

function giveWay(mover: { x: number; y: number }, other: { x: number; y: number }): void {
  const gap = Math.hypot(mover.x - other.x, mover.y - other.y);
  if (gap >= FALLEN_GAP) return;
  const [ux, uy] = gap > 0 ? [(mover.x - other.x) / gap, (mover.y - other.y) / gap] : [1, 0];
  mover.x += ux * (FALLEN_GAP - gap);
  mover.y += uy * (FALLEN_GAP - gap);
  const fromHole = Math.hypot(mover.x - HOLE.x, mover.y - HOLE.y);
  if (fromHole >= FALL_FLOOR || fromHole === 0) return;
  mover.x = HOLE.x + ((mover.x - HOLE.x) / fromHole) * FALL_FLOOR;
  mover.y = HOLE.y + ((mover.y - HOLE.y) / fromHole) * FALL_FLOOR;
}

/** A `#rrggbb` colour shifted toward the hole's red by up to MAX_REDDEN. */
export function redshift(colour: string, pull: number): string {
  if (pull <= 0) return colour;
  const share = MAX_REDDEN * Math.min(pull, 1);
  const channels = [1, 3, 5].map((at, i) => {
    const own = parseInt(colour.slice(at, at + 2), 16);
    return Math.round(own + (RED[i] - own) * share);
  });
  return `#${channels.map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}
