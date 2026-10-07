import { MAX_SNOOZE_DAYS } from '../../triage/triage.ts';
import { ToolArgError } from './tool-args.ts';

/** A snooze as the page records and says it. */
export interface SnoozeSpan {
  readonly days: number;
  /** "till Monday 12 October". */
  readonly words: string;
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 86_400_000;
const SAID = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

const startOfDay = (date: Date): Date =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());

/** The calendar date `text` names as YYYY-MM-DD, or null when it names none. */
function dateOf(text: string): Date | null {
  const parts = ISO_DATE.exec(text);
  if (!parts) return null;
  const [year, month, day] = parts.slice(1).map(Number);
  const date = new Date(year, month - 1, day);
  return date.getMonth() === month - 1 && date.getDate() === day ? date : null;
}

/** A snooze until the date `until` names, counted in whole days from `today`.
 *  Rounded, since a day that changes the clocks is not 24 hours long. */
export function snoozeSpanUntil(until: string, today: Date): SnoozeSpan {
  const date = dateOf(until);
  if (!date) throw new ToolArgError('until must be a date, as YYYY-MM-DD');
  const days = Math.round((date.getTime() - startOfDay(today).getTime()) / DAY_MS);
  if (days < 1 || days > MAX_SNOOZE_DAYS) {
    throw new ToolArgError(`until must be after today and at most ${MAX_SNOOZE_DAYS} days away`);
  }
  return { days, words: `till ${SAID.format(date)}` };
}
