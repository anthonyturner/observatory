import { formatCount, formatDay } from './log-format';
import { DAY_MS, LogFilter } from './log-levels';
import { LogDay, LogFault, LogSnapshot } from './log-snapshot';

// The meteor record: errors and warnings per day along the bottom of the log
// sky, each day a streak as tall as its faults, its head red if anything
// errored and amber if only warnings fell.

/** The strip's drawing height, in CSS pixels. */
export const METEOR_HEIGHT = 58;
const TOP_ROOM = 8;
const MIN_STREAK = 3;
const MAX_LINE_WIDTH = 4;
const LINE_SHARE = 0.55;
const HEAD_SHARE = 0.45;
/** The tip keeps this far right of the pointer, and inside the strip. */
const TIP_OFFSET = 14;
const TIP_MIN_LEFT = 120;
const TIP_RIGHT_ROOM = 100;

/** Every day in the span, the silent ones too: a gap is information. */
export function meteorDays(snapshot: LogSnapshot): LogDay[] {
  const { from, to } = snapshot.span;
  if (!from || !to) return [];
  const have = new Map(snapshot.timeline.map((day) => [day.day, day]));
  const days: LogDay[] = [];
  const end = Date.parse(`${to.slice(0, 10)}T12:00:00`);
  for (let time = Date.parse(`${from.slice(0, 10)}T12:00:00`); time <= end; time += DAY_MS) {
    const key = localDay(new Date(time));
    days.push(have.get(key) ?? { day: key, error: 0, warn: 0, info: 0 });
  }
  return days;
}

const twoDigits = (value: number): string => String(value).padStart(2, '0');
const localDay = (date: Date): string =>
  `${date.getFullYear()}-${twoDigits(date.getMonth() + 1)}-${twoDigits(date.getDate())}`;

/** What a day's streak measures under the legend's filter. */
export const dayValue = (day: LogDay, filter: LogFilter): number =>
  filter === 'error' ? day.error : filter === 'warn' ? day.warn : day.error + day.warn;

/** One day's streak, in the strip's pixels. */
export interface MeteorStreak {
  readonly x: number;
  readonly top: number;
  /** Red if anything errored (and errors are shown), amber otherwise. */
  readonly level: 'error' | 'warn';
}

/** The strip's drawing: streaks, their width, and the traced fault's lifetime. */
export interface MeteorGeometry {
  readonly width: number;
  readonly height: number;
  readonly lineWidth: number;
  readonly headRadius: number;
  readonly streaks: readonly MeteorStreak[];
  /** The traced fault's first to last day, as a band behind the streaks. */
  readonly lifetime: { readonly x: number; readonly width: number } | null;
}

/** Square-root heights: one bad day ran to a thousand, and on a linear scale
 *  it flattens every other day to a dot. The caption says so. */
export function meteorGeometry(
  days: readonly LogDay[],
  size: { readonly width: number; readonly filter: LogFilter; readonly traced: LogFault | null },
): MeteorGeometry {
  const { width, filter, traced } = size;
  const height = METEOR_HEIGHT;
  const band = width / Math.max(days.length, 1);
  const most = Math.max(1, ...days.map((day) => dayValue(day, filter)));
  const lineWidth = Math.max(1, Math.min(band * LINE_SHARE, MAX_LINE_WIDTH));
  const streaks = days.flatMap((day, index): MeteorStreak[] => {
    const value = dayValue(day, filter);
    if (!value) return [];
    return [
      {
        x: index * band + band / 2,
        top: height - 1 - Math.max(MIN_STREAK, Math.sqrt(value / most) * (height - TOP_ROOM)),
        level: day.error && filter !== 'warn' ? 'error' : 'warn',
      },
    ];
  });
  return {
    width,
    height,
    lineWidth,
    headRadius: Math.max(1, lineWidth * HEAD_SHARE),
    streaks,
    lifetime: traced ? lifetimeBand(days, traced, band) : null,
  };
}

function lifetimeBand(
  days: readonly LogDay[],
  fault: LogFault,
  band: number,
): MeteorGeometry['lifetime'] {
  const first = days.findIndex((day) => day.day === fault.firstAt.slice(0, 10));
  const last = days.findIndex((day) => day.day === fault.lastAt.slice(0, 10));
  if (first < 0 || last < 0) return null;
  return { x: first * band, width: (last - first + 1) * band };
}

/** The strip's caption: what it counts, its span, and its busiest day. */
export interface MeteorCaption {
  /** `Errors and warnings per day`. */
  readonly what: string;
  /** `Jun 21 → Sep 26 · peak`. */
  readonly span: string;
  /** `1,616`, shown in bold. */
  readonly peak: string;
  /** `on Sep 26 · √ height`. */
  readonly after: string;
}

export function meteorCaption(
  days: readonly LogDay[],
  filter: LogFilter,
  locale?: string,
): MeteorCaption | null {
  if (!days.length) return null;
  const peak = days.reduce((best, day) =>
    dayValue(day, filter) > dayValue(best, filter) ? day : best,
  );
  const what =
    filter === 'error' ? 'Errors' : filter === 'warn' ? 'Warnings' : 'Errors and warnings';
  return {
    what: `${what} per day`,
    span: `${formatDay(days[0].day, locale)} → ${formatDay(days[days.length - 1].day, locale)} · peak`,
    peak: formatCount(dayValue(peak, filter), locale),
    after: `on ${formatDay(peak.day, locale)} · √ height`,
  };
}

/** The day under a pointer `x` pixels into a strip `width` wide, if any. */
export const dayAt = (days: readonly LogDay[], x: number, width: number): LogDay | null =>
  days[Math.floor((x / width) * days.length)] ?? null;

/** `Sep 26 · 166 errors · 1,479 warnings · 540,308 info`. */
export const meteorTip = (day: LogDay, locale?: string): string =>
  `${formatDay(day.day, locale)} · ${formatCount(day.error, locale)} errors · ` +
  `${formatCount(day.warn, locale)} warnings · ${formatCount(day.info, locale)} info`;

/** Where the tip's centre sits, `x` pixels into a strip `width` wide. */
export const tipLeft = (x: number, width: number): number =>
  Math.min(Math.max(x + TIP_OFFSET, TIP_MIN_LEFT), width - TIP_RIGHT_ROOM);
