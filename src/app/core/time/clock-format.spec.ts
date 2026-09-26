import { toClockFace, toDayLabel } from './clock-format';

describe('clock format', () => {
  const morning = new Date(2026, 8, 25, 9, 5, 7);

  it('pads hours, minutes and seconds to two digits', () => {
    expect(toClockFace(morning)).toEqual({ hoursMinutes: '09:05', seconds: '07' });
  });

  it('reads the day as weekday and date', () => {
    expect(toDayLabel(morning, 'en-US')).toBe('Fri · Sep 25');
  });
});
