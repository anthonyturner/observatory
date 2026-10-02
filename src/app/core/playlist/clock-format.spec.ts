import { clockOf, spokenClockOf } from './clock-format';

describe('clockOf', () => {
  it('writes minutes and seconds, and hours once there are any', () => {
    expect(clockOf(7)).toBe('0:07');
    expect(clockOf(265.9)).toBe('4:25');
    expect(clockOf(3729)).toBe('1:02:09');
  });

  it('never goes below zero', () => {
    expect(clockOf(-3)).toBe('0:00');
  });
});

describe('spokenClockOf', () => {
  it('says each part that is not zero, singular where it is one', () => {
    expect(spokenClockOf(3729)).toBe('1 hour 2 minutes 9 seconds');
    expect(spokenClockOf(60)).toBe('1 minute');
    expect(spokenClockOf(0)).toBe('0 seconds');
  });
});
