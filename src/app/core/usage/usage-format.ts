const MINUTE_MS = 60_000;
const MINUTES_PER_HOUR = 60;
const MINUTES_PER_DAY = 1440;
/** Past this an age reads in days rather than hours. */
const HOURS_BEFORE_DAYS = 48;

const twoDigits = (value: number): string => String(value).padStart(2, '0');

/** "1.2B", "1.2M", "940k", "12". */
export function formatTokens(count: number): string {
  if (count >= 1e9) return `${(count / 1e9).toFixed(1)}B`;
  if (count >= 1e6) return `${(count / 1e6).toFixed(1)}M`;
  if (count >= 1e3) return `${Math.round(count / 1e3)}k`;
  return String(Math.round(count));
}

/** Whole percents, with one decimal kept below 10 where there is one. */
export function formatPercent(percent: number): string {
  return String(percent < 10 && percent % 1 ? percent.toFixed(1) : Math.round(percent));
}

/** How long ago `iso` was, shortly: "now", "4m", "3h", "2d". */
export function ageOf(iso: string, now: number): string {
  const minutes = Math.max(0, Math.round((now - Date.parse(iso)) / MINUTE_MS));
  if (minutes < 1) return 'now';
  if (minutes < MINUTES_PER_HOUR) return `${minutes}m`;
  if (minutes < HOURS_BEFORE_DAYS * MINUTES_PER_HOUR)
    return `${Math.round(minutes / MINUTES_PER_HOUR)}h`;
  return `${Math.round(minutes / MINUTES_PER_DAY)}d`;
}

/** "09:50", in local time. */
export function hoursMinutes(epochMs: number): string {
  const date = new Date(epochMs);
  return `${twoDigits(date.getHours())}:${twoDigits(date.getMinutes())}`;
}

/** "Fri 19:00", in local time and the given locale. */
export function weekdayTime(epochMs: number, locale?: string): string {
  const weekday = new Date(epochMs).toLocaleDateString(locale, { weekday: 'short' });
  return `${weekday} ${hoursMinutes(epochMs)}`;
}

/** "2026-09-26": the local calendar day, as the usage rows key it. */
export function localDayKey(epochMs: number): string {
  const date = new Date(epochMs);
  return `${date.getFullYear()}-${twoDigits(date.getMonth() + 1)}-${twoDigits(date.getDate())}`;
}
