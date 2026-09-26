import {
  METEOR_HEIGHT,
  dayAt,
  dayValue,
  meteorCaption,
  meteorDays,
  meteorGeometry,
  meteorTip,
  tipLeft,
} from './meteor-record';
import { LOG_FIXTURE } from './testing/log-fixture';

const days = meteorDays(LOG_FIXTURE);

describe('meteorDays', () => {
  it('lists every day in the span, the silent ones as zeros', () => {
    expect(days.map((day) => day.day)).toEqual([
      '2026-09-20',
      '2026-09-21',
      '2026-09-22',
      '2026-09-23',
      '2026-09-24',
      '2026-09-25',
      '2026-09-26',
    ]);
    expect(days[1]).toEqual({ day: '2026-09-21', error: 0, warn: 0, info: 0 });
  });
});

describe('dayValue', () => {
  it('counts what the filter lights', () => {
    const [, , busy] = days;
    expect(
      [null, 'error', 'warn', 'quiet'].map((filter) => dayValue(busy, filter as never)),
    ).toEqual([7, 3, 4, 7]);
  });
});

describe('meteorGeometry', () => {
  it('draws a square-root streak per day that had any, red where something errored', () => {
    const geometry = meteorGeometry(days, { width: 700, filter: null, traced: null });

    expect(geometry.lineWidth).toBe(4);
    expect(geometry.headRadius).toBeCloseTo(1.8);
    expect(geometry.streaks).toEqual([
      { x: 50, top: METEOR_HEIGHT - 1 - Math.sqrt(1 / 11) * 50, level: 'error' },
      { x: 250, top: METEOR_HEIGHT - 1 - Math.sqrt(7 / 11) * 50, level: 'error' },
      { x: 650, top: METEOR_HEIGHT - 1 - 50, level: 'error' },
    ]);
  });

  it('keeps a small day visible, and shows warnings amber under the warnings filter', () => {
    const geometry = meteorGeometry(
      [
        { day: '2026-09-20', error: 1, warn: 1, info: 0 },
        { day: '2026-09-21', error: 0, warn: 900, info: 0 },
      ],
      { width: 200, filter: 'warn', traced: null },
    );

    expect(geometry.streaks.map((streak) => [streak.top, streak.level])).toEqual([
      [METEOR_HEIGHT - 1 - Math.max(3, Math.sqrt(1 / 900) * 50), 'warn'],
      [METEOR_HEIGHT - 1 - 50, 'warn'],
    ]);
  });

  it('shades the traced fault from its first day to its last', () => {
    const [first] = LOG_FIXTURE.faults;
    const geometry = meteorGeometry(days, { width: 700, filter: null, traced: first });

    expect(geometry.lifetime).toEqual({ x: 0, width: 700 });
  });
});

describe('meteorCaption', () => {
  it('says what it counts, its span and its peak day', () => {
    expect(meteorCaption(days, null, 'en-US')).toEqual({
      what: 'Errors and warnings per day',
      span: 'Sep 20 → Sep 26 · peak',
      peak: '11',
      after: 'on Sep 26 · √ height',
    });
    expect(meteorCaption(days, 'error', 'en-US')?.what).toBe('Errors per day');
    expect(meteorCaption(days, 'error', 'en-US')?.after).toBe('on Sep 22 · √ height');
  });
});

describe('the hover tip', () => {
  it('finds the day under the pointer and gives its counts', () => {
    const day = dayAt(days, 260, 700);
    expect(day?.day).toBe('2026-09-22');
    expect(day && meteorTip(day, 'en-US')).toBe('Sep 22 · 3 errors · 4 warnings · 500 info');
    expect(dayAt(days, 701, 700)).toBeNull();
  });

  it('stays inside the strip', () => {
    expect(tipLeft(10, 700)).toBe(120);
    expect(tipLeft(300, 700)).toBe(314);
    expect(tipLeft(690, 700)).toBe(600);
  });
});
