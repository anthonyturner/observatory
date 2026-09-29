import { TokenDay } from '../usage/usage-document';
import { localDayKey } from '../usage/usage-format';
import { BUSIEST_PACE, QUIETEST_PACE, activityPace } from './trail-activity';

const DAY_MS = 24 * 60 * 60 * 1000;
/** Noon, local time: half the day gone. */
const NOON = new Date(2026, 8, 29, 12, 0, 0).getTime();

const day = (daysAgo: number, tokens: number): TokenDay => ({
  day: localDayKey(NOON - daysAgo * DAY_MS),
  families: { opus: tokens },
  cacheRead: 0,
  messages: 0,
  sessions: 0,
  toolCalls: 0,
  subagents: 0,
});

/** Usual days of 1,000 tokens, with a day off among them. */
const usualWeek = [day(5, 1000), day(4, 0), day(3, 900), day(2, 1000), day(1, 1100)];

describe('activityPace', () => {
  it('turns at the natural pace on a usual day, pro rata for the hour', () => {
    expect(activityPace([...usualWeek, day(0, 500)], NOON)).toBe(1);
  });

  it('turns twice as fast with twice the usual work by now', () => {
    expect(activityPace([...usualWeek, day(0, 1000)], NOON)).toBe(2);
  });

  it('never goes slower or faster than its bounds', () => {
    expect(activityPace([...usualWeek, day(0, 0)], NOON)).toBe(QUIETEST_PACE);
    expect(activityPace([...usualWeek, day(0, 90_000)], NOON)).toBe(BUSIEST_PACE);
  });

  it('counts at least two hours as gone, so the first minutes after midnight are not frantic', () => {
    const justAfterMidnight = new Date(2026, 8, 29, 0, 5).getTime();

    expect(activityPace([...usualWeek, day(0, 100)], justAfterMidnight)).toBe(1.2);
  });

  it('cannot say with too few working days to know what usual is', () => {
    expect(activityPace([day(2, 0), day(1, 1000), day(0, 5000)], NOON)).toBeNull();
  });

  it('cannot say when the usage has no row for today', () => {
    expect(activityPace(usualWeek, NOON)).toBeNull();
  });
});
