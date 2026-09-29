import { BAR_S, barAt } from './ambient-score';
import { LINES, melodyFor } from './home-melody';

/** D natural minor, as pitch classes. */
const D_MINOR = [2, 4, 5, 7, 9, 10, 0];
const pitchClass = (midi: number): number => ((midi % 12) + 12) % 12;

describe('melodyFor', () => {
  it('writes one line per chord of the loop', () => {
    expect(LINES).toHaveLength(4);
  });

  it('keeps every note in D minor, and every long note on its chord', () => {
    for (let index = 0; index < 8; index++) {
      const chord = barAt(index).pad.map(pitchClass);
      for (const note of melodyFor(index)) {
        expect(D_MINOR).toContain(pitchClass(note.midi));
        if (note.lengthS > BAR_S / 8) expect(chord).toContain(pitchClass(note.midi));
      }
    }
  });

  it('fits every note inside its bar', () => {
    for (let index = 0; index < 8; index++) {
      for (const note of melodyFor(index)) {
        expect(note.offsetS).toBeGreaterThanOrEqual(0);
        expect(note.offsetS + note.lengthS).toBeLessThanOrEqual(BAR_S + 1e-9);
      }
    }
  });

  it('answers an octave up on the second pass', () => {
    const first = melodyFor(1).map((note) => note.midi);
    expect(melodyFor(5).map((note) => note.midi)).toEqual(first.map((midi) => midi + 12));
    expect(melodyFor(9).map((note) => note.midi)).toEqual(first);
  });

  it('holds back to one long note under the build', () => {
    const [held, ...rest] = melodyFor(7);
    expect(rest).toHaveLength(0);
    expect(held.lengthS).toBeGreaterThan(BAR_S / 2);
  });
});
