import { numberAt } from '../../../core/assistant/spoken-numbers';
import { SNOOZE_DAYS } from '../../../core/queue/triage-client';

/** How long a snooze lasts, and how Jev says it: "till Monday". */
export interface SnoozeUntil {
  readonly days: number;
  readonly words: string;
}

const DAYS_PER_WEEK = 7;
const WEEKDAYS = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
] as const;

/** Words that only join the number to the time: "till", "for", "next". */
const JOINERS: ReadonlySet<string> = new Set([
  'till',
  'til',
  "'til",
  'until',
  'to',
  'for',
  'through',
  'on',
  'next',
  'this',
  'coming',
]);
const DAY_UNITS: ReadonlyMap<string, number> = new Map([
  ['day', 1],
  ['days', 1],
  ['week', DAYS_PER_WEEK],
  ['weeks', DAYS_PER_WEEK],
]);
/** "a week" and "one day" count one. */
const ONE: ReadonlySet<string> = new Set(['a', 'an', 'one']);

const capitalised = (word: string): string => word.charAt(0).toUpperCase() + word.slice(1);

const forDays = (days: number): SnoozeUntil => ({
  days,
  words:
    days % DAYS_PER_WEEK === 0
      ? `for ${days === DAYS_PER_WEEK ? 'a week' : `${days / DAYS_PER_WEEK} weeks`}`
      : `for ${days === 1 ? 'a day' : `${days} days`}`,
});

/** Days from `today` to the next `weekday`: a week when it is today. */
function tillWeekday(weekday: number, today: Date): SnoozeUntil {
  const days = (weekday - today.getDay() + DAYS_PER_WEEK) % DAYS_PER_WEEK || DAYS_PER_WEEK;
  return { days, words: `till ${capitalised(WEEKDAYS[weekday])}` };
}

/** "3 days", "a week", "two weeks". */
function countOf(words: readonly string[]): SnoozeUntil | null {
  const count = ONE.has(words[0]) ? { value: 1, length: 1 } : numberAt(words, 0);
  const unit =
    count && words.length === count.length + 1 ? DAY_UNITS.get(words[count.length]) : undefined;
  return count && unit && count.value > 0 ? forDays(count.value * unit) : null;
}

/** One time on its own: "tomorrow", "Monday", "week" (as in "next week"). */
function oneWordOf(word: string, today: Date): SnoozeUntil | null {
  if (word === 'tomorrow') return { days: 1, words: 'till tomorrow' };
  if (word === 'week') return forDays(DAYS_PER_WEEK);
  const weekday = (WEEKDAYS as readonly string[]).indexOf(word);
  return weekday < 0 ? null : tillWeekday(weekday, today);
}

/** How long the words after a snooze's number ask for, from `today`: a week
 *  when they name no time, or null when they are not a time at all. */
export function snoozeUntilOf(words: readonly string[], today: Date): SnoozeUntil | null {
  const said = words.filter((word) => !JOINERS.has(word));
  if (!said.length) return words.length ? null : forDays(SNOOZE_DAYS);
  if (said.length === 1) return oneWordOf(said[0], today);
  return countOf(said);
}
