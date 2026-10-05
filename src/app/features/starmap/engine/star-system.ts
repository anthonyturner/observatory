import { QUICK_COLOUR, SkyStar } from './sky-model';

/* What orbits a pull request's star: a disc of gas for what it costs to
   review, and a planet for each issue it closes. Sizes are in starRadius
   units, so they scale with the star. */

/** Under twenty lines there is nothing to weigh. */
const MIN_MASS = 1.3;

export interface Mass {
  /** log10 of the lines changed, plus one. */
  readonly log: number;
  /** How heavy it looks, between 0 and 1. */
  readonly weight: number;
  /** How far the disc reaches. */
  readonly reach: number;
  readonly colour: string;
}

/** The disc reaches further and weighs more, on a log scale, the more lines change. */
export function massOf(star: Pick<SkyStar, 'cost' | 'quick' | 'colour'>): Mass | null {
  const log = Math.log10((star.cost ?? 0) + 1);
  if (log < MIN_MASS) return null;
  return {
    log,
    weight: Math.min(1, log / 3),
    reach: 1.5 + log * 0.75,
    colour: star.quick ? QUICK_COLOUR : star.colour,
  };
}

/** The angle the disc and orbits are turned to, on screen: slowly, unless frozen. */
export const systemTurn = (spin: number, t: number, frozen: boolean): number =>
  (frozen ? spin : spin + t * 0.12) * 0.2 - 0.35;

export interface IssuePlanet {
  readonly issue: number;
  readonly orbit: number;
  readonly size: number;
  /** Radians a second: Kepler, loosely, so outer planets lag. */
  readonly speed: number;
  readonly phase: number;
  /** An index into the planets' tones. */
  readonly tone: number;
}

export const PLANET_TONE_COUNT = 3;
const MAX_PLANETS = 4;
const FIRST_ORBIT = 1.9;
const ORBIT_STEP = 0.6;
const PLANET_SIZE = 0.18;
const INNER_SPEED = 0.5;

/** One planet per issue the pull request closes, up to four; none when it closes none. */
export function issuePlanets(star: Pick<SkyStar, 'item'>): IssuePlanet[] {
  return (star.item?.issues ?? []).slice(0, MAX_PLANETS).map((issue, i) => {
    const orbit = FIRST_ORBIT + i * ORBIT_STEP;
    return {
      issue,
      orbit,
      size: PLANET_SIZE,
      speed: INNER_SPEED / Math.pow(orbit / FIRST_ORBIT, 1.5),
      phase: (issue * 2.39996) % (Math.PI * 2),
      tone: issue % PLANET_TONE_COUNT,
    };
  });
}
