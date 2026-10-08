import { AlertKind, AlertSeverity } from '../../../core/security/security-report';

export interface Point {
  readonly x: number;
  readonly y: number;
}

/** The tokens.css colour each grade is drawn in. */
export const SEVERITY_TOKEN: Readonly<Record<AlertSeverity, string>> = {
  critical: 'security-critical',
  high: 'security-high',
  medium: 'security-medium',
  low: 'security-low',
};

const TAU = Math.PI * 2;
const ROCK_CORNERS = 9;
/** A rock's corners sit between these shares of its size, so no two look alike. */
const ROCK_LUMP = 0.35;
const SHARD_LENGTH = 1.45;
const SHARD_WIDTH = 0.5;
const SPARK_POINTS = 4;
const SPARK_REACH = 1.4;
const SPARK_WAIST = 0.32;
/** Radians a second: the slowest tumble, and how much faster the quickest turns. */
const TUMBLE_FROM = 0.15;
const TUMBLE_RANGE = 0.45;
/** Seconds for one throb of a critical hazard's glow. */
const THROB_PERIOD_S = 2.6;

/** A lumpy rock, its corners set by `seed`. */
function rock(seed: number): Point[] {
  return Array.from({ length: ROCK_CORNERS }, (_, index) => {
    const turn = (index / ROCK_CORNERS) * TAU;
    const lump = (Math.sin((index + 1) * 12.9898 * (seed + 1)) * 43758.5453) % 1;
    const reach = 1 - ROCK_LUMP * Math.abs(lump);
    return { x: Math.cos(turn) * reach, y: Math.sin(turn) * reach };
  });
}

const SHARD: readonly Point[] = [
  { x: SHARD_LENGTH, y: 0 },
  { x: 0, y: SHARD_WIDTH },
  { x: -SHARD_LENGTH * 0.7, y: 0 },
  { x: 0, y: -SHARD_WIDTH },
];

const SPARK: readonly Point[] = Array.from({ length: SPARK_POINTS * 2 }, (_, index) => {
  const turn = (index / (SPARK_POINTS * 2)) * TAU;
  const reach = index % 2 ? SPARK_WAIST : SPARK_REACH;
  return { x: Math.cos(turn) * reach, y: Math.sin(turn) * reach };
});

/**
 * Each kind's shape, at a size of 1: a dependency's alert is a lumpy rock, a
 * code alert a sharp shard, and a leaked secret a four-pointed spark.
 */
export function outlineOf(kind: AlertKind, seed: number): readonly Point[] {
  switch (kind) {
    case 'dependabot':
      return rock(seed);
    case 'code-scanning':
      return SHARD;
    case 'secret-scanning':
      return SPARK;
  }
}

/** How far a hazard has turned at scene time `time`: each at its own pace, from its own start. */
export const tumbleOf = (time: number, seed: number): number =>
  seed * TAU + time * (TUMBLE_FROM + TUMBLE_RANGE * seed);

/** A critical hazard's glow, 0 to 1, at scene time `time`, on its own phase. */
export const throbOf = (time: number, seed: number): number =>
  0.5 + 0.5 * Math.sin((time / THROB_PERIOD_S + seed) * TAU);
