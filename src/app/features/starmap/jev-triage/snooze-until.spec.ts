import { snoozeTimeIn, snoozeUntilOf } from './snooze-until';

/** A Wednesday. */
const WEDNESDAY = new Date(2026, 9, 7, 10, 0);

const until = (said: string) => snoozeUntilOf(said ? said.split(' ') : [], WEDNESDAY);

describe('snoozeUntilOf', () => {
  it('snoozes for the card’s week when no time is named', () => {
    expect(until('')).toEqual({ days: 7, words: 'for a week' });
  });

  it('counts to the next weekday named, with or without “till” or “next”', () => {
    expect(until('till monday')).toEqual({ days: 5, words: 'till Monday' });
    expect(until('until next friday')).toEqual({ days: 2, words: 'till Friday' });
    expect(until('thursday')).toEqual({ days: 1, words: 'till Thursday' });
  });

  it('takes today’s weekday as a week away', () => {
    expect(until('till wednesday')).toEqual({ days: 7, words: 'till Wednesday' });
  });

  it('reads tomorrow, next week and counts of days or weeks', () => {
    expect(until('till tomorrow')).toEqual({ days: 1, words: 'till tomorrow' });
    expect(until('till next week')).toEqual({ days: 7, words: 'for a week' });
    expect(until('for 3 days')).toEqual({ days: 3, words: 'for 3 days' });
    expect(until('for a day')).toEqual({ days: 1, words: 'for a day' });
    expect(until('for two weeks')).toEqual({ days: 14, words: 'for 2 weeks' });
  });

  it('is no time at all for anything else', () => {
    expect(until('till')).toBeNull();
    expect(until('till later')).toBeNull();
    expect(until('for 3 hours')).toBeNull();
    expect(until('for 0 days')).toBeNull();
    expect(until('monday and friday')).toBeNull();
  });
});

describe('snoozeTimeIn', () => {
  const timeIn = (said: string) => snoozeTimeIn(said ? said.split(' ') : [], WEDNESDAY);

  it.each<[string, number, string]>([
    ['', 7, 'for a week'],
    ['till monday', 5, 'till Monday'],
    ["because it's stale till monday", 5, 'till Monday'],
    ['till monday because it is stale', 5, 'till Monday'],
    ['for three days while i am away', 3, 'for 3 days'],
    ["because it's stale", 7, 'for a week'],
  ])('finds the time in %j', (said, days, words) => {
    expect(timeIn(said)).toEqual({ days, words });
  });

  it('finds none when a time is started but is not one', () => {
    for (const said of ['till the cows come home', 'for the release', 'weeks']) {
      expect(timeIn(said), said).toBeNull();
    }
  });
});
