import { LimitWindow } from '../../../core/usage/usage-document';
import { formatPercent, hoursMinutes } from '../../../core/usage/usage-format';

const HOUR_MS = 3_600_000;
const EVEN_DAY_PERCENT = 100 / 7;
/** Readings stop while the machine sleeps, so the last one before midnight
 *  stands for the day's start only this close to it; an older one would fold
 *  the days between into today. */
const DAY_START_TOLERANCE_MS = 6 * HOUR_MS;

const localMidnight = (now: number): number => new Date(now).setHours(0, 0, 0, 0);

/** Where the week stood when today began, and from when, if not from midnight. */
function dayStart(week: LimitWindow, midnight: number): { percent: number; since?: number } | null {
  if (week.startsAt && Date.parse(week.startsAt) >= midnight) return { percent: 0 };
  const before = week.points.filter(([at]) => at < midnight).at(-1);
  if (before && midnight - before[0] <= DAY_START_TOLERANCE_MS) return { percent: before[1] };
  const first = week.points.find(([at]) => at >= midnight);
  return first ? { percent: first[1], since: first[0] } : null;
}

/** "today +12% · an even day is 14%": how much of the weekly limit today has
 *  used. Claude Code has no daily limit, so the week's even share stands in. */
export function weekToday(week: LimitWindow, now: number): string {
  const evenDay = `an even day is ${formatPercent(EVEN_DAY_PERCENT)}%`;
  const start = dayStart(week, localMidnight(now));
  if (!start) return `today unknown · no reading yet today · ${evenDay}`;
  const since = start.since === undefined ? '' : ` since ${hoursMinutes(start.since)}`;
  return `today +${formatPercent(Math.max(0, week.pct - start.percent))}%${since} · ${evenDay}`;
}
