import {
  FRIDAY,
  NO_REVIEWS,
  dueWeek,
  markDone,
  reviewMoment,
  snoozeToMonday,
  weekKey,
} from './agent-review-week';

const at = (day: number, hour: number, minute = 0) =>
  new Date(2026, 9, day, hour, minute).getTime();
/** Friday 2 October 2026; the week began Monday 28 September. */
const FRIDAY_2 = 2;

describe('weekly review timing', () => {
  it('names a week by its Monday, whatever day it is', () => {
    expect(weekKey(at(FRIDAY_2, 15))).toBe('2026-09-28');
    expect(weekKey(new Date(2026, 8, 28, 0, 1).getTime())).toBe('2026-09-28');
    expect(weekKey(at(4, 23))).toBe('2026-09-28');
    expect(weekKey(at(5, 0))).toBe('2026-10-05');
  });

  it('falls due on the chosen day from two in the afternoon, not a minute before', () => {
    expect(reviewMoment(at(1, 9), FRIDAY)).toBe(at(FRIDAY_2, 14));
    expect(dueWeek(at(FRIDAY_2, 13, 59), FRIDAY, NO_REVIEWS)).toBeNull();
    expect(dueWeek(at(FRIDAY_2, 14), FRIDAY, NO_REVIEWS)).toBe('2026-09-28');
  });

  it('stays due over the weekend until it is done, and a new week starts clean', () => {
    expect(dueWeek(at(4, 20), FRIDAY, NO_REVIEWS)).toBe('2026-09-28');
    const done = markDone(NO_REVIEWS, '2026-09-28');

    expect(dueWeek(at(4, 20), FRIDAY, done)).toBeNull();
    expect(dueWeek(at(6, 10), FRIDAY, done)).toBeNull();
    expect(dueWeek(at(9, 14), FRIDAY, done)).toBe('2026-10-05');
  });

  it('puts a review off until Monday morning, then brings it back', () => {
    const snoozed = snoozeToMonday(NO_REVIEWS, '2026-09-28', at(FRIDAY_2, 15));

    expect(dueWeek(at(FRIDAY_2, 16), FRIDAY, snoozed)).toBeNull();
    expect(dueWeek(at(5, 8, 59), FRIDAY, snoozed)).toBeNull();
    expect(dueWeek(at(5, 9), FRIDAY, snoozed)).toBe('2026-09-28');
    expect(dueWeek(at(5, 9), FRIDAY, markDone(snoozed, '2026-09-28'))).toBeNull();
  });

  it('follows the chosen day', () => {
    expect(dueWeek(at(FRIDAY_2, 15), 3, NO_REVIEWS)).toBe('2026-09-28');
    expect(dueWeek(at(1, 15), 5, NO_REVIEWS)).toBeNull();
  });

  it('keeps only the last few done weeks', () => {
    let state = NO_REVIEWS;
    for (let week = 0; week < 12; week++) state = markDone(state, `w${week}`);

    expect(state.done).toHaveLength(8);
    expect(state.done.at(-1)).toBe('w11');
  });
});
