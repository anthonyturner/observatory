import { LimitWindow } from '../../../../core/usage/usage-document';
import { percentText, weekdayText, whenText } from '../usage-text';
import {
  AXIS_LABEL_RISE,
  ChartHit,
  ChartLine,
  ChartText,
  Margins,
  gridRow,
  percentY,
  tenth,
} from './chart-marks';

const HEIGHT = 190;
const MARGINS: Margins = { left: 40, right: 12, top: 12, bottom: 24 };
const GRID_PERCENTS = [0, 25, 50, 75, 100] as const;
const DAY_MS = 86_400_000;
const WEEK_DAYS = 7;
const TICK_LENGTH = 4;
const NOW_LABEL_GAP = 4;
const NOW_LABEL_DROP = 9;
const FULL = 100;
/** A reading's tooltip column is never narrower than this. */
const MIN_HIT_WIDTH = 6;

/** This week, reading by reading, as `weekChart` lays it out. */
export interface WeekChart {
  readonly width: number;
  readonly height: number;
  readonly grid: readonly ChartLine[];
  readonly axis: readonly ChartText[];
  readonly now: { readonly line: ChartLine; readonly label: ChartText } | null;
  readonly area: string | null;
  readonly line: string | null;
  /** Dashed on from the last reading: amber when it runs out before the reset. */
  readonly projection: { readonly path: string; readonly isOver: boolean } | null;
  readonly dot: { readonly x: number; readonly y: number } | null;
  readonly hits: readonly ChartHit[];
}

export interface WeekChartInput {
  readonly week: LimitWindow;
  readonly width: number;
  readonly now: number;
  readonly locale?: string;
}

const startOf = (week: LimitWindow): number =>
  week.startsAt ? Date.parse(week.startsAt) : Date.parse(week.resetsAt) - WEEK_DAYS * DAY_MS;

function weekdayAxis(
  start: number,
  x: (at: number) => number,
  bottom: number,
  locale?: string,
): { grid: ChartLine[]; axis: ChartText[] } {
  const grid: ChartLine[] = [];
  const axis: ChartText[] = [];
  for (let day = 0; day <= WEEK_DAYS; day++) {
    const at = start + day * DAY_MS;
    grid.push({ x1: x(at), x2: x(at), y1: bottom, y2: bottom + TICK_LENGTH });
    if (day === WEEK_DAYS) continue;
    const middle = at + DAY_MS / 2;
    axis.push({
      x: x(middle),
      y: HEIGHT - AXIS_LABEL_RISE,
      text: weekdayText(middle, locale),
      anchor: 'middle',
    });
  }
  return { grid, axis };
}

function projectionOf(
  week: LimitWindow,
  from: { x: number; y: number },
  place: { x: (at: number) => number; y: (percent: number) => number },
): WeekChart['projection'] {
  const projection = week.projection;
  if (!projection) return null;
  const endAt = projection.fullAt ? Date.parse(projection.fullAt) : Date.parse(week.resetsAt);
  const endPercent = projection.fullAt ? FULL : projection.atReset;
  return {
    path: `M${from.x},${from.y}L${place.x(endAt)},${place.y(endPercent)}`,
    isOver: Boolean(projection.fullAt),
  };
}

/** The week's readings as a line over its seven days, with where the recent
 *  pace leads and a line at now. */
export function weekChart({ week, width, now, locale }: WeekChartInput): WeekChart {
  const start = startOf(week);
  const end = Date.parse(week.resetsAt);
  const plotWidth = width - MARGINS.left - MARGINS.right;
  const bottom = HEIGHT - MARGINS.bottom;
  const x = (at: number) =>
    MARGINS.left + ((Math.min(Math.max(at, start), end) - start) / (end - start)) * plotWidth;
  const y = percentY(HEIGHT, MARGINS);

  const rows = GRID_PERCENTS.map((percent) =>
    gridRow(y(percent), MARGINS.left, width - MARGINS.right, `${percent}%`),
  );
  const days = weekdayAxis(start, x, bottom, locale);
  const isNowInside = now > start && now < end;
  const chart = {
    width,
    height: HEIGHT,
    grid: [...rows.map((row) => row.line), ...days.grid],
    axis: [...rows.map((row) => row.label), ...days.axis],
    now: isNowInside
      ? {
          line: { x1: x(now), x2: x(now), y1: MARGINS.top, y2: bottom },
          label: {
            x: x(now) + NOW_LABEL_GAP,
            y: MARGINS.top + NOW_LABEL_DROP,
            text: 'now',
            anchor: 'start' as const,
          },
        }
      : null,
  };
  const points = week.points;
  if (!points.length) {
    return { ...chart, area: null, line: null, projection: null, dot: null, hits: [] };
  }

  const line = points
    .map(([at, percent], index) => `${index ? 'L' : 'M'}${tenth(x(at))},${tenth(y(percent))}`)
    .join('');
  const [lastAt, lastPercent] = points[points.length - 1];
  const dot = { x: x(lastAt), y: y(lastPercent) };
  const step = Math.max(plotWidth / points.length, MIN_HIT_WIDTH);
  return {
    ...chart,
    area: `${line}L${tenth(x(lastAt))},${y(0)}L${tenth(x(points[0][0]))},${y(0)}Z`,
    line,
    projection: projectionOf(week, dot, { x, y }),
    dot,
    hits: points.map(([at, percent]) => ({
      x: tenth(x(at) - step / 2),
      y: MARGINS.top,
      width: tenth(step),
      height: bottom - MARGINS.top,
      tip: `${whenText(at, locale)}\n${percentText(percent)} of the week used`,
    })),
  };
}
