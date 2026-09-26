import { seededRandom } from '../instrument/seeded-random';
import { Box } from '../orrery/orrery-camera';
import { QUEUE_BUCKETS, QueueBucket, QueueItem, shownBucket } from './queue-report';

/** One pull request as a star, with everything that does not change per frame. */
export interface ChartStar {
  readonly item: QueueItem;
  readonly bucket: QueueBucket;
  /** Its resting place on the sky, in chart units. */
  readonly x: number;
  readonly y: number;
  /** Magnitude: a star's size, growing with how long it has sat untouched. */
  readonly magnitude: number;
  readonly isUrgent: boolean;
  readonly driftRadius: number;
  readonly driftPhaseA: number;
  readonly driftPhaseB: number;
  readonly driftRateA: number;
  readonly driftRateB: number;
  readonly twinklePhase: number;
  readonly twinkleRate: number;
  /** Where its urgent ring's pulse starts. */
  readonly pulsePhase: number;
  /** Seconds after the chart appears that it lights up: in queue order. */
  readonly delay: number;
}

/** One bucket's constellation. */
export interface Constellation {
  readonly bucket: QueueBucket;
  readonly centreX: number;
  readonly centreY: number;
  readonly stars: readonly ChartStar[];
}

export interface StarChartLayout {
  readonly constellations: readonly Constellation[];
  readonly stars: readonly ChartStar[];
  /** Everything drawn, for framing the view. */
  readonly bounds: Box;
}

/** The chart's plane: wide, like a sky seen through a window. */
export const CHART_WIDTH = 3600;
export const CHART_HEIGHT = 2000;
/** Constellations sit alternately above and below the middle, so labels do not collide. */
const ROW_OFFSET = 170;
const ROW_STAGGER = 37;
const ROW_STAGGER_SPAN = 120;
const BASE_SPREAD = 300;
const SPREAD_PER_STAR = 42;
const MAX_SPREAD = 620;
const JITTER = 70;
const BASE_MAGNITUDE = 4;
const MAGNITUDE_PER_ROOT_DAY = 2.6;
const MAX_EXTRA_MAGNITUDE = 13;
const BASE_DRIFT = 9;
const DRIFT_PER_IDLE_DAY = 0.42;
const MAX_EXTRA_DRIFT = 26;
const FIRST_DELAY = 0.1;
const DELAY_PER_STAR = 0.035;
const MAX_DELAY = 3;
/** A pull request's seed: Knuth's multiplicative hash of its number. */
const seedOf = (number: number): number => (number * 2654435761) % 2147483647;

const URGENT: ReadonlySet<QueueBucket> = new Set(['conflicted', 'failing']);

/**
 * One constellation per bucket that has pull requests, left to right in
 * bucket order. Inside each, stars fan out along an arc in queue order;
 * magnitude and drift follow neglect.
 */
export function layoutStars(items: readonly QueueItem[]): StarChartLayout {
  const used = QUEUE_BUCKETS.filter((bucket) => items.some((item) => shownBucket(item) === bucket));
  const slot = CHART_WIDTH / (used.length + 1);
  let order = 0;
  const constellations = used.map((bucket, column) => {
    const mine = items.filter((item) => shownBucket(item) === bucket);
    const centreX = slot * (column + 1);
    const centreY =
      CHART_HEIGHT / 2 +
      (column % 2 === 0 ? -1 : 1) * (ROW_OFFSET + ((column * ROW_STAGGER) % ROW_STAGGER_SPAN));
    const spread = Math.min(BASE_SPREAD + mine.length * SPREAD_PER_STAR, MAX_SPREAD);
    const stars = mine.map((item, index) => {
      const random = seededRandom(seedOf(item.number));
      const along = mine.length === 1 ? 0.5 : index / (mine.length - 1);
      const angle = (-0.85 + along * 1.7) * Math.PI * 0.42;
      const radius = spread * (0.45 + 0.55 * along);
      const idle = Math.max(item.idleDays, 0);
      return {
        item,
        bucket,
        x: centreX + Math.sin(angle) * radius + (random() - 0.5) * JITTER,
        y: centreY - Math.cos(angle) * radius * 0.52 + (random() - 0.5) * JITTER,
        magnitude:
          BASE_MAGNITUDE + Math.min(Math.sqrt(idle) * MAGNITUDE_PER_ROOT_DAY, MAX_EXTRA_MAGNITUDE),
        isUrgent: URGENT.has(bucket),
        driftRadius: BASE_DRIFT + Math.min(idle * DRIFT_PER_IDLE_DAY, MAX_EXTRA_DRIFT),
        driftPhaseA: random() * Math.PI * 2,
        driftPhaseB: random() * Math.PI * 2,
        driftRateA: 0.26 + random() * 0.3,
        driftRateB: 0.21 + random() * 0.26,
        twinklePhase: random() * Math.PI * 2,
        twinkleRate: 0.55 + random() * 1.5,
        pulsePhase: random(),
        delay: FIRST_DELAY + Math.min(order++ * DELAY_PER_STAR, MAX_DELAY),
      };
    });
    return { bucket, centreX, centreY, stars };
  });
  const stars = constellations.flatMap((constellation) => constellation.stars);
  return { constellations, stars, bounds: boundsOf(stars) };
}

function boundsOf(stars: readonly ChartStar[]): Box {
  if (!stars.length) return { left: 0, top: 0, right: CHART_WIDTH, bottom: CHART_HEIGHT };
  return {
    left: Math.min(...stars.map((star) => star.x)),
    top: Math.min(...stars.map((star) => star.y)),
    right: Math.max(...stars.map((star) => star.x)),
    bottom: Math.max(...stars.map((star) => star.y)),
  };
}

/** Where a star is at scene time `time`: its resting place plus a slow drift. */
export function starPosition(star: ChartStar, time: number): { x: number; y: number } {
  return {
    x: star.x + Math.sin(time * star.driftRateA + star.driftPhaseA) * star.driftRadius,
    y: star.y + Math.cos(time * star.driftRateB + star.driftPhaseB) * star.driftRadius * 0.78,
  };
}

/** Two waves of different periods, so the twinkle never settles into a beat. */
export const starPulse = (star: ChartStar, time: number): number =>
  0.78 +
  Math.sin(time * star.twinkleRate + star.twinklePhase) * 0.16 +
  Math.sin(time * star.twinkleRate * 2.7 + star.twinklePhase * 1.7) * 0.07;

/** 0 to 1 as a star lights up, eased. */
export function starGrowth(star: ChartStar, sinceShown: number): number {
  const progress = (sinceShown - star.delay) / 0.9;
  if (progress <= 0) return 0;
  if (progress >= 1) return 1;
  return 1 - Math.pow(1 - progress, 3);
}
