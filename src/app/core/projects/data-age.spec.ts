import { ageWords, fogLevel } from './data-age';

const at = (hoursAgo: number, now: Date): string =>
  new Date(now.getTime() - hoursAgo * 3_600_000).toISOString();

describe('fogLevel', () => {
  const now = new Date('2026-09-26T12:00:00Z');

  it('stays clear for six hours, then thickens until three days', () => {
    expect(fogLevel(at(1, now), now)).toBe(0);
    expect(fogLevel(at(6, now), now)).toBe(0);
    expect(fogLevel(at(39, now), now)).toBeCloseTo(0.5);
    expect(fogLevel(at(72, now), now)).toBe(1);
    expect(fogLevel(at(200, now), now)).toBe(1);
  });

  it('stays clear for a date it cannot read', () => {
    expect(fogLevel('not a date', now)).toBe(0);
  });
});

describe('ageWords', () => {
  const now = new Date('2026-09-26T12:00:00Z');

  it('says hours under two days and days after', () => {
    expect(ageWords(at(9, now), now)).toBe('9 hours');
    expect(ageWords(at(1, now), now)).toBe('1 hour');
    expect(ageWords(at(80, now), now)).toBe('3 days');
  });
});
