import { easeOut } from '../instrument/easing';
import { CometFlight } from './comets';

/* When work gets done, green comets flare out of the sky into the core: one
   per closed issue or merged pull request, a few at a time. */

export interface Flare {
  /** Scene seconds when it sets off. */
  readonly startS: number;
  /** 0 to 1 along the top edge where it sets off. */
  readonly entry: number;
  readonly lengthPx: number;
}

/** The most flares one report sets off, however much got done. */
export const MAX_FLARES = 12;
/** How long a flare takes to reach the core, and the gap between one and the next. */
export const FLARE_S = 1.6;
const STAGGER_S = 0.14;
const MIN_LENGTH_PX = 120;
const LENGTH_SPREAD_PX = 120;
const FADE_OUT = 0.25;
const BRIGHTNESS = 0.95;

/** `count` flares setting off from `now`, one after another, from across the top. */
export function flaresFrom(count: number, now: number, random: () => number): Flare[] {
  return Array.from({ length: Math.min(MAX_FLARES, Math.max(0, count)) }, (_, i) => ({
    startS: now + i * STAGGER_S,
    entry: random(),
    lengthPx: MIN_LENGTH_PX + random() * LENGTH_SPREAD_PX,
  }));
}

/** Where a flare is at `time`, heading from above the top edge into the pole,
 *  gathering speed as it goes; null before it sets off and once it arrives. */
export function flareAt(
  flare: Flare,
  time: number,
  target: { width: number; poleX: number; poleY: number },
): CometFlight | null {
  const progress = (time - flare.startS) / FLARE_S;
  if (progress < 0 || progress > 1) return null;
  const fromX = flare.entry * target.width;
  const fromY = -flare.lengthPx;
  const along = easeOut(progress) ** 2;
  const headX = fromX + (target.poleX - fromX) * along;
  const headY = fromY + (target.poleY - fromY) * along;
  const distance = Math.hypot(target.poleX - fromX, target.poleY - fromY) || 1;
  const unitX = (target.poleX - fromX) / distance;
  const unitY = (target.poleY - fromY) / distance;
  return {
    headX,
    headY,
    tailX: headX - unitX * flare.lengthPx,
    tailY: headY - unitY * flare.lengthPx,
    alpha: BRIGHTNESS * Math.min(1, (1 - progress) / FADE_OUT),
  };
}
