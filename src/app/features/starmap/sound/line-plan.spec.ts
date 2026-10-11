import { SpokenClip } from '../../../core/voice/voice-protocol';
import { GAP_S, ReadyLine, lengthOf, placeLines } from './line-plan';

/** A clip `seconds` long. */
const clip = (seconds: number): SpokenClip => ({ audio: new Float32Array(seconds * 10), rate: 10 });

const line = (at: number, seconds: number, lateS: number): ReadyLine => ({
  clip: clip(seconds),
  at,
  lateS,
});

describe('lengthOf', () => {
  it('is the clip’s seconds', () => {
    expect(lengthOf(clip(2))).toBe(2);
  });
});

describe('placeLines', () => {
  it('starts each line at its own moment when the voice is free', () => {
    const { plays } = placeLines([line(10, 1, 0.5), line(20, 1, 0.5)], 0, 5);

    expect(plays.map((play) => play.startAt)).toEqual([10, 20]);
  });

  it('puts a line after the one before it when they would overlap', () => {
    const { plays, freeAt } = placeLines([line(10, 1, 0.5), line(10.2, 1, 2)], 0, 5);

    expect(plays.map((play) => play.startAt)).toEqual([10, 10 + 1 + GAP_S]);
    expect(freeAt).toBeCloseTo(10 + 1 + GAP_S + 1 + GAP_S);
  });

  it('drops a line that would start later than it may, and gives its room to the next', () => {
    const { plays } = placeLines([line(10, 3, 0.5), line(10.5, 1, 0.5), line(15, 1, 0.5)], 0, 5);

    expect(plays.map((play) => play.at)).toEqual([10, 15]);
  });

  it('drops a line whose moment has passed, however free the voice is', () => {
    const { plays, freeAt } = placeLines([line(10, 1, 0.4)], 0, 11);

    expect(plays).toEqual([]);
    expect(freeAt).toBe(0);
  });

  it('keeps one that is just inside its tolerance', () => {
    const { plays } = placeLines([line(10, 1, 0.4)], 0, 10.3);

    expect(plays.map((play) => play.startAt)).toEqual([10.3]);
  });

  it('waits for lines already placed in an earlier call', () => {
    const { plays } = placeLines([line(10, 1, 3)], 12, 10);

    expect(plays.map((play) => play.startAt)).toEqual([12]);
  });
});
