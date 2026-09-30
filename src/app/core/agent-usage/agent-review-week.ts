/* When the weekly Agent review card is due. A week runs Monday to Sunday in
   local time and is named by its Monday, as YYYY-MM-DD. */

import { localDayKey } from '../usage/usage-format';

/** Days of the week as Date numbers them: 0 is Sunday. */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export const FRIDAY: Weekday = 5;
/** The card appears from this hour on the chosen day. */
export const REVIEW_HOUR = 14;
/** "Remind me Monday" brings it back at this hour. */
export const SNOOZE_HOUR = 9;

/** What the owner has done about the weekly review. */
export interface ReviewState {
  /** The weeks whose review is done, most recent last. */
  readonly done: readonly string[];
  /** A review put off until a moment, for the week it belongs to. */
  readonly snooze: { readonly week: string; readonly until: number } | null;
}

export const NO_REVIEWS: ReviewState = { done: [], snooze: null };
/** Enough past weeks to know the last few are done; older ones cannot come back. */
const WEEKS_KEPT = 8;

/** The Monday that starts the week `at` falls in, at midnight local time. */
export function weekStart(at: number): Date {
  const date = new Date(at);
  const sinceMonday = (date.getDay() + 6) % 7;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() - sinceMonday);
}

export const weekKey = (at: number): string => localDayKey(weekStart(at).getTime());

/** The chosen day of `at`'s week, at the review hour. */
export function reviewMoment(at: number, day: Weekday): number {
  const monday = weekStart(at);
  const offset = (day + 6) % 7;
  return new Date(
    monday.getFullYear(),
    monday.getMonth(),
    monday.getDate() + offset,
    REVIEW_HOUR,
  ).getTime();
}

/** The week whose review the card should show now, or null for none. A review
 *  put off to Monday comes back then, even though a new week has begun. */
export function dueWeek(now: number, day: Weekday, state: ReviewState): string | null {
  const { snooze, done } = state;
  if (snooze && now >= snooze.until && !done.includes(snooze.week)) return snooze.week;
  const week = weekKey(now);
  if (now < reviewMoment(now, day) || done.includes(week)) return null;
  return snooze?.week === week ? null : week;
}

/** The review of `week` done: it will not come back. */
export function markDone(state: ReviewState, week: string): ReviewState {
  return {
    done: [...state.done.filter((each) => each !== week), week].slice(-WEEKS_KEPT),
    snooze: null,
  };
}

/** The review of `week` put off until the next Monday morning after `now`. */
export function snoozeToMonday(state: ReviewState, week: string, now: number): ReviewState {
  const monday = weekStart(now);
  const next = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 7, SNOOZE_HOUR);
  return { ...state, snooze: { week, until: next.getTime() } };
}
