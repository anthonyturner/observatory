import { snoozeUntilOf } from './snooze-until';

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
