import { BAR_S, CHORDS, TONIC, barAt, hz } from './ambient-score';
import { seededRandom } from '../instrument/seeded-random';

describe('ambient score', () => {
  it('tunes A4 to 440 Hz', () => {
    expect(hz(69)).toBe(440);
    expect(hz(81)).toBeCloseTo(880);
  });

  it('walks the four chords and loops', () => {
    const random = seededRandom(1);
    expect(barAt(0, random).chord).toBe(CHORDS[0]);
    expect(barAt(3, random).chord).toBe(CHORDS[3]);
    expect(barAt(4, random).chord).toBe(CHORDS[0]);
  });

  it('keeps every ping on a note of its chord, inside the bar, and in the room', () => {
    const random = seededRandom(7);
    for (let index = 0; index < 40; index++) {
      const bar = barAt(index, random);
      expect(bar.pings.length).toBeGreaterThanOrEqual(2);
      for (const ping of bar.pings) {
        const tone = (((ping.midi - TONIC) % 12) + 12) % 12;
        expect(bar.chord.map((n) => ((n % 12) + 12) % 12)).toContain(tone);
        expect(ping.offsetS).toBeGreaterThanOrEqual(0);
        expect(ping.offsetS).toBeLessThan(BAR_S);
        expect(Math.abs(ping.pan)).toBeLessThanOrEqual(0.8);
      }
    }
  });

  it('puts the drone two octaves under the chord root', () => {
    expect(barAt(1, seededRandom(1)).root).toBe(TONIC - 24 + CHORDS[1][0]);
  });

  it('sweeps once every four bars', () => {
    const random = seededRandom(3);
    expect([0, 1, 2, 3, 4, 5, 6, 7].map((i) => barAt(i, random).hasSweep)).toEqual([
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
});
