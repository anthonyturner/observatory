import {
  ageOf,
  formatPercent,
  formatTokens,
  hoursMinutes,
  localDayKey,
  weekdayTime,
} from './usage-format';

describe('usage formatting', () => {
  it('shortens token counts', () => {
    expect(formatTokens(2_400_000_000)).toBe('2.4B');
    expect(formatTokens(1_234_567)).toBe('1.2M');
    expect(formatTokens(940_400)).toBe('940k');
    expect(formatTokens(12.4)).toBe('12');
  });

  it('keeps a decimal only for small fractional percents', () => {
    expect(formatPercent(4.5)).toBe('4.5');
    expect(formatPercent(4)).toBe('4');
    expect(formatPercent(53.8)).toBe('54');
  });

  it('says how old a reading is', () => {
    const now = Date.parse('2026-09-26T12:00:00Z');
    expect(ageOf('2026-09-26T11:59:50Z', now)).toBe('now');
    expect(ageOf('2026-09-26T11:56:00Z', now)).toBe('4m');
    expect(ageOf('2026-09-26T09:00:00Z', now)).toBe('3h');
    expect(ageOf('2026-09-23T12:00:00Z', now)).toBe('3d');
  });

  it('writes local times and days', () => {
    const friday = new Date(2026, 8, 25, 9, 5).getTime();
    expect(hoursMinutes(friday)).toBe('09:05');
    expect(weekdayTime(friday, 'en-US')).toBe('Fri 09:05');
    expect(localDayKey(friday)).toBe('2026-09-25');
  });
});
