import { CHORDS, TONIC, barAt, hz, uneaseOf } from './ambient-score';

describe('ambient score', () => {
  it('tunes A4 to 440 Hz', () => {
    expect(hz(69)).toBe(440);
    expect(hz(81)).toBeCloseTo(880);
  });

  it('walks the four chords and loops', () => {
    expect(barAt(0).chord).toBe(CHORDS[0]);
    expect(barAt(3).chord).toBe(CHORDS[3]);
    expect(barAt(4).chord).toBe(CHORDS[0]);
  });

  it('puts the root two octaves under the chord', () => {
    expect(barAt(1).root).toBe(TONIC - 24 + CHORDS[1][0]);
  });

  it('sweeps once every four bars', () => {
    expect([0, 1, 2, 3, 4, 5, 6, 7].map((i) => barAt(i).hasSweep)).toEqual([
      false,
      false,
      false,
      true,
      false,
      false,
      false,
      true,
    ]);
  });

  it('sweeps every other bar under strain', () => {
    expect([0, 1, 2, 3].map((i) => barAt(i, 0.8).hasSweep)).toEqual([false, true, false, true]);
  });
});

describe('uneaseOf', () => {
  it('follows the mood, and is a little uneasy while unknown', () => {
    expect(uneaseOf({ name: 'calm', stress: 0 })).toBe(0);
    expect(uneaseOf({ name: 'strained', stress: 0.9 })).toBe(0.9);
    expect(uneaseOf({ name: 'unknown', stress: 0 })).toBeGreaterThan(0);
  });
});
