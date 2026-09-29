import { seededRandom } from '../instrument/seeded-random';

/** One background star. Positions are in orrery units, before parallax. */
export interface FieldStar {
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  readonly alpha: number;
  /** How much of the camera's movement it follows: far stars move less. */
  readonly depth: number;
  /** How far behind the system it sits in the 3D sky, in orrery units (negative). */
  readonly z: number;
  readonly phase: number;
  /** How fast it twinkles. */
  readonly rate: number;
  /** An index into the field's tints. */
  readonly tint: number;
}

export const FIELD_TINT_COUNT = 5;
const FIELD_SEED = 8675309;
const FIELD_STARS = 620;
const FIELD_WIDTH = 3600;
const FIELD_HEIGHT = 2600;

/** The same sky on every load. */
export function starField(count = FIELD_STARS): FieldStar[] {
  const random = seededRandom(FIELD_SEED);
  return Array.from({ length: count }, () => ({
    x: (random() - 0.5) * FIELD_WIDTH,
    y: (random() - 0.5) * FIELD_HEIGHT,
    radius: random() * 1.2 + 0.2,
    alpha: random() * 0.4 + 0.06,
    depth: 0.28 + random() * 0.38,
    z: -12000 - random() * 30000,
    phase: random() * Math.PI * 2,
    rate: 0.3 + random() * 1.8,
    tint: Math.floor(random() * FIELD_TINT_COUNT),
  }));
}

/** Brightness now, between 0.2 and 1 of the star's own. */
export const twinkle = (star: FieldStar, time: number): number =>
  0.6 + Math.sin(time * star.rate + star.phase) * 0.4;
