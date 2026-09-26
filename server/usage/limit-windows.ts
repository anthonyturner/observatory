import { existsSync, readFileSync } from 'node:fs';
import type {
  LimitSample,
  LimitWindow,
  Limits,
  Point,
  WeekProjection,
  WindowReading,
} from './usage-types.ts';

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;
/** The weekly chart is a few hundred pixels wide; more points add bytes, not detail. */
const MAX_WEEK_POINTS = 336;
const MAX_FIVE_HOUR_POINTS = 120;
/** How far back the pace is read: long enough to smooth over a night's sleep,
 *  short enough to follow a busy day. */
const PACE_WINDOW_MS = 2 * DAY_MS;
/** Two readings closer than this have no meaningful pace between them. */
const MIN_PACE_SPAN_MS = HOUR_MS;
/** Resets this close are the same window: the reset is reported to the second
 *  and need not repeat exactly. */
const SAME_RESET_MS = HOUR_MS;
const FULL_PERCENT = 100;

/** Every reading in a samples file, oldest first; lines that do not parse are skipped. */
export function readSamples(file: string): LimitSample[] {
  if (!existsSync(file)) return [];
  return readFileSync(file, 'utf8')
    .split('\n')
    .filter(Boolean)
    .flatMap((line) => {
      try {
        const sample = JSON.parse(line) as LimitSample;
        return sample?.at && (sample.week || sample.five) ? [sample] : [];
      } catch {
        return [];
      }
    })
    .sort((a, b) => a.at.localeCompare(b.at));
}

/** Keeps the highest reading in each slice, so thinning never hides a peak. */
export function thin(points: readonly Point[], max: number): Point[] {
  if (points.length <= max) return [...points];
  const step = points.length / max;
  return Array.from({ length: max }, (_, index) =>
    points
      .slice(Math.floor(index * step), Math.floor((index + 1) * step))
      .reduce((highest, point) => (point[1] >= highest[1] ? point : highest)),
  );
}

const round = (value: number, places: number): number => {
  const scale = 10 ** places;
  return Math.round(value * scale) / scale;
};

/** Where the week will stand at its reset if the recent pace holds; null
 *  until two readings are far enough apart to have a pace. */
export function projectWeek(
  points: readonly Point[],
  resetsAt: string,
  now: number,
): WeekProjection | null {
  if (points.length < 2) return null;
  const [lastAt, lastPercent] = points[points.length - 1];
  const [fromAt, fromPercent] = points.find(([at]) => at >= lastAt - PACE_WINDOW_MS) ?? points[0];
  const span = lastAt - fromAt;
  if (span < MIN_PACE_SPAN_MS) return null;

  const perHour = Math.max(0, (lastPercent - fromPercent) / (span / HOUR_MS));
  // From now, not the last reading: after a quiet night the pace resumes from
  // here, and a run-out time is never in the past.
  const start = Math.max(now, lastAt);
  const hoursLeft = Math.max(0, (Date.parse(resetsAt) - start) / HOUR_MS);
  const atReset = lastPercent + perHour * hoursLeft;
  const fullAt =
    perHour > 0 && atReset > FULL_PERCENT
      ? new Date(start + ((FULL_PERCENT - lastPercent) / perHour) * HOUR_MS).toISOString()
      : null;
  return { perHour: round(perHour, 2), atReset: round(atReset, 1), fullAt };
}

const sameReset = (a: string, b: string): boolean =>
  Math.abs(Date.parse(a) - Date.parse(b)) < SAME_RESET_MS;

type WindowKey = 'week' | 'five';

/** The window's newest reading, with every reading of that same window as points. */
function windowOf(
  samples: readonly LimitSample[],
  key: WindowKey,
  maxPoints: number,
  now: number,
): LimitWindow | null {
  const latest = samples.findLast((sample) => sample[key])?.[key];
  if (!latest) return null;
  const points = samples
    .filter((sample): sample is LimitSample & Record<WindowKey, WindowReading> =>
      Boolean(sample[key] && sameReset(sample[key].resetsAt, latest.resetsAt)),
    )
    .map((sample): Point => [Date.parse(sample.at), sample[key].pct]);
  return {
    pct: latest.pct,
    resetsAt: latest.resetsAt,
    expired: Date.parse(latest.resetsAt) <= now,
    points: thin(points, maxPoints),
  };
}

/** The current week and five-hour window. Each comes from the newest reading
 *  that carries it, since Claude Code may leave either out. */
export function limitsFrom(samples: readonly LimitSample[], now: number): Limits | null {
  if (!samples.length) return null;
  const week = windowOf(samples, 'week', MAX_WEEK_POINTS, now);
  return {
    at: samples[samples.length - 1].at,
    since: samples[0].at,
    week: week && {
      ...week,
      projection: week.expired ? null : projectWeek(week.points, week.resetsAt, now),
    },
    five: windowOf(samples, 'five', MAX_FIVE_HOUR_POINTS, now),
  };
}
