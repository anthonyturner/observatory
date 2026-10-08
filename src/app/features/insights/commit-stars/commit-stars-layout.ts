import { CommitWeek } from '../../../core/insights/insights-report';
import { tenth } from '../../../shared/charts/chart-marks';

/** One week as a star: the busier the week, the bigger it is. */
export interface WeekStar {
  readonly key: number;
  readonly x: number;
  readonly y: number;
  readonly r: number;
  /** A week with no commits: a faint point, so the line still runs through it. */
  readonly isDark: boolean;
}

export interface StarStrip {
  readonly width: number;
  readonly height: number;
  readonly stars: readonly WeekStar[];
  /** The constellation's line, through every star in order, as SVG points. */
  readonly line: string;
}

const WIDTH = 240;
const HEIGHT = 40;
const INSET = 8;
const MIN_RADIUS = 1;
const MAX_RADIUS = 5;
/** How far a star strays above or below the middle: scenery, the same on every load. */
const WANDER = 7;
const WANDER_STEP = 1.9;

/** The radius for a week's commits: area grows with the count, the busiest week largest. */
export function starRadius(total: number, busiest: number): number {
  if (!total || !busiest) return MIN_RADIUS;
  return MIN_RADIUS + (MAX_RADIUS - MIN_RADIUS) * Math.sqrt(total / busiest);
}

/** The weeks as a small constellation, oldest at the left. */
export function commitStars(weeks: readonly CommitWeek[]): StarStrip {
  const busiest = Math.max(0, ...weeks.map((week) => week.total));
  const step = weeks.length > 1 ? (WIDTH - 2 * INSET) / (weeks.length - 1) : 0;
  const stars = weeks.map((week, index) => ({
    key: week.start,
    x: tenth(INSET + index * step),
    y: tenth(HEIGHT / 2 + Math.sin(index * WANDER_STEP) * WANDER),
    r: tenth(starRadius(week.total, busiest)),
    isDark: !week.total,
  }));
  return {
    width: WIDTH,
    height: HEIGHT,
    stars,
    line: stars.map((star) => `${star.x},${star.y}`).join(' '),
  };
}
