import { UsageDocument } from '../../../core/usage/usage-document';
import { formatPercent } from '../../../core/usage/usage-format';

const MINUTE_MS = 60_000;
const MINUTES_PER_HOUR = 60;
const MINUTES_PER_DAY = 1440;
/** Past this an age reads in days rather than hours. */
const HOURS_BEFORE_DAYS = 48;
/** A day key ("2026-09-26") is read at local noon, clear of either midnight. */
const DAY_KEY_LENGTH = 10;
const NOON = 'T12:00:00';
/** Beyond this a label is cut short with an ellipsis. */
const LABEL_MAX = 24;

/** "42%", or "4.5%" below ten. */
export const percentText = (percent: number): string => `${formatPercent(percent)}%`;

/** "Fri 3:00 PM": a moment within the week. */
export const whenText = (epochMs: number, locale?: string): string =>
  new Date(epochMs).toLocaleString(locale, {
    weekday: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });

/** "Sep 25", from a day key or an ISO time. */
export function dayText(dayOrIso: string, locale?: string): string {
  const at = dayOrIso.length === DAY_KEY_LENGTH ? `${dayOrIso}${NOON}` : dayOrIso;
  return new Date(at).toLocaleDateString(locale, { month: 'short', day: 'numeric' });
}

/** "Sat": the weekday of a moment. */
export const weekdayText = (epochMs: number, locale?: string): string =>
  new Date(epochMs).toLocaleDateString(locale, { weekday: 'short' });

/** "just now", "12 min ago", "10 h ago", "3 days ago". */
export function agoText(iso: string, now: number): string {
  const minutes = Math.max(0, Math.round((now - Date.parse(iso)) / MINUTE_MS));
  if (minutes < 1) return 'just now';
  if (minutes < MINUTES_PER_HOUR) return `${minutes} min ago`;
  if (minutes < HOURS_BEFORE_DAYS * MINUTES_PER_HOUR) {
    return `${Math.round(minutes / MINUTES_PER_HOUR)} h ago`;
  }
  return `${Math.round(minutes / MINUTES_PER_DAY)} days ago`;
}

/** A label cut to fit beside its bar. */
export const clipLabel = (label: string): string =>
  label.length > LABEL_MAX ? `${label.slice(0, LABEL_MAX - 1)}…` : label;

/** The header's line: "Claude Code · 42% of the week used · refreshed …". */
export function usageStamp(document: UsageDocument | null, locale?: string): string {
  if (!document) return 'no usage read yet';
  const week = document.limits?.week;
  const used = week && !week.expired ? `${percentText(week.pct)} of the week used · ` : '';
  return `Claude Code · ${used}refreshed ${new Date(document.generatedAt).toLocaleString(locale)}`;
}
