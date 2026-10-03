import { MusicAnalysis } from './music-analysis';
import { BandLevels } from './music-sync.types';

const FRAME_S = 1 / 60;
const QUIET: BandLevels = { bass: 0.1, mid: 0.1, high: 0.1, kick: 0.1 };
const LOUD: BandLevels = { bass: 0.9, mid: 0.8, high: 0.7, kick: 0.9 };

/** Plays `levels(t)` for `seconds` from `fromS`, collecting each frame. */
function play(
  analysis: MusicAnalysis,
  levels: (timeS: number) => BandLevels,
  seconds: number,
  fromS = 0,
) {
  const frames = [];
  for (let t = fromS; t < fromS + seconds; t += FRAME_S) frames.push(analysis.read(levels(t), t));
  return frames;
}

/** A kick every half second (120 BPM) from a quarter second in, each a tenth of a second long. */
const kicks = (timeS: number): BandLevels =>
  timeS >= 0.25 && (timeS - 0.25) % 0.5 < 0.1
    ? { bass: 0.9, mid: 0.3, high: 0.3, kick: 0.9 }
    : { bass: 0.1, mid: 0.3, high: 0.3, kick: 0.1 };

describe('MusicAnalysis', () => {
  it('finds one beat per kick', () => {
    const frames = play(new MusicAnalysis(), kicks, 3.9);
    expect(frames.filter((frame) => frame.beat).length).toBe(8);
  });

  it('finds no beats in a steady hum or in silence', () => {
    const hum = play(new MusicAnalysis(), () => ({ bass: 0.6, mid: 0.6, high: 0.6, kick: 0.6 }), 3, 1);
    // Past the first second, once the analysis has settled on the hum's level.
    expect(hum.slice(60).some((frame) => frame.beat)).toBe(false);
    const silence = play(new MusicAnalysis(), () => ({ bass: 0, mid: 0, high: 0, kick: 0 }), 3);
    expect(silence.some((frame) => frame.beat)).toBe(false);
  });

  it('counts a sustained kick once, however long it rings', () => {
    const ringing = (t: number): BandLevels => (t < 0.25 ? QUIET : LOUD);
    const frames = play(new MusicAnalysis(), ringing, 0.27);
    expect(frames.filter((frame) => frame.beat).length).toBe(1);
  });

  it('marks a drop when the music surges after a quiet stretch, and only once a phrase', () => {
    const analysis = new MusicAnalysis();
    play(analysis, () => QUIET, 6);
    const surge = play(analysis, () => LOUD, 6, 6);
    expect(surge.filter((frame) => frame.drop).length).toBe(1);
  });

  it('carries the band levels and their energy through', () => {
    const [frame] = play(
      new MusicAnalysis(),
      () => ({ bass: 0.3, mid: 0.6, high: 0.9, kick: 0.3 }),
      FRAME_S,
    );
    expect(frame).toEqual(expect.objectContaining({ bass: 0.3, mid: 0.6, high: 0.9, kick: 0.3 }));
    expect(frame.energy).toBeCloseTo(0.6);
  });

  it('never finds more than three beats a second, however fast the kicks come', () => {
    const fast = (t: number): BandLevels => (t % 0.2 < 0.05 ? LOUD : QUIET);
    const frames = play(new MusicAnalysis(), fast, 3);
    expect(frames.filter((frame) => frame.beat).length).toBeLessThanOrEqual(9);
  });
});
