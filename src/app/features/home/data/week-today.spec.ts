import { LimitWindow } from '../../../core/usage/usage-document';
import { weekToday } from './week-today';

const HOUR = 3_600_000;
const MIDNIGHT = new Date(2026, 8, 30).getTime();
const NOW = MIDNIGHT + 10 * HOUR;
const EVEN_DAY = 'an even day is 14%';

const week = (points: [number, number][], startsAt = MIDNIGHT - 5 * 24 * HOUR): LimitWindow => ({
  pct: points.at(-1)?.[1] ?? 0,
  resetsAt: new Date(startsAt + 7 * 24 * HOUR).toISOString(),
  startsAt: new Date(startsAt).toISOString(),
  points,
});

describe('weekToday', () => {
  it('counts from the last reading before midnight', () => {
    const reading = weekToday(
      week([
        [MIDNIGHT - 2 * HOUR, 40],
        [MIDNIGHT + 9 * HOUR, 52],
      ]),
      NOW,
    );

    expect(reading).toBe(`today +12% · ${EVEN_DAY}`);
  });

  it('counts from the first reading today when the one before midnight is days old', () => {
    const reading = weekToday(
      week([
        [MIDNIGHT - 3 * 24 * HOUR, 6],
        [MIDNIGHT + 8 * HOUR, 50],
        [MIDNIGHT + 9 * HOUR, 56],
      ]),
      NOW,
    );

    expect(reading).toBe(`today +6% since 08:00 · ${EVEN_DAY}`);
  });

  it('counts the whole week when it began today', () => {
    const reading = weekToday(week([[MIDNIGHT + 9 * HOUR, 3]], MIDNIGHT + HOUR), NOW);

    expect(reading).toBe(`today +3% · ${EVEN_DAY}`);
  });

  it('says so when there is no reading today', () => {
    const reading = weekToday(week([[MIDNIGHT - 3 * 24 * HOUR, 6]]), NOW);

    expect(reading).toBe(`today unknown · no reading yet today · ${EVEN_DAY}`);
  });
});
