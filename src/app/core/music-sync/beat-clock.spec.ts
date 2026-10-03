import { BeatClock, BeatReading, MIN_BEAT_GAP_S } from './beat-clock';

const FRAME_S = 1 / 60;

/** Plays kicks at `kickTimes` for `seconds`, collecting the time of each beat. */
function play(kickTimes: readonly number[], seconds: number, clock = new BeatClock()) {
  const beats: number[] = [];
  const readings: { timeS: number; reading: BeatReading }[] = [];
  let next = 0;
  for (let t = 0; t < seconds; t += FRAME_S) {
    const kick = next < kickTimes.length && kickTimes[next] <= t;
    if (kick) next++;
    const reading = clock.read(kick, t);
    if (reading.beat) beats.push(t);
    readings.push({ timeS: t, reading });
  }
  return { beats, readings };
}

const kicksAt = (bpm: number, fromS: number, toS: number): number[] => {
  const kicks: number[] = [];
  for (let t = fromS; t < toS; t += 60 / bpm) kicks.push(t);
  return kicks;
};

/** The beat nearest each of `times`, and how far off it was. */
const offsets = (beats: readonly number[], times: readonly number[]): number[] =>
  times.map((time) => Math.min(...beats.map((beat) => Math.abs(beat - time))));

describe('BeatClock', () => {
  it('makes each kick a beat until it has the tempo', () => {
    const kicks = [0.5, 1.0, 1.5];
    expect(play(kicks, 1.6).beats.length).toBe(3);
  });

  it('locks to a steady 4/4 and lands each beat on its kick', () => {
    const kicks = kicksAt(128, 0.2, 10);
    const { beats } = play(kicks, 10);
    const late = kicks.filter((k) => k > 3);
    for (const off of offsets(beats, late)) expect(off).toBeLessThanOrEqual(0.04);
    // A beat lands a touch ahead of its kick, to make up for hearing it late.
    expect(beats.filter((b) => b > 3 - 0.05).length).toBe(late.length);
  });

  it('keeps the beat through kicks it misses', () => {
    const all = kicksAt(140, 0.2, 10);
    const heard = all.filter((_, i) => i < 8 || i % 4 !== 2);
    const missed = all.filter((k) => !heard.includes(k));
    const { beats } = play(heard, 10);
    for (const off of offsets(beats, missed)) expect(off).toBeLessThanOrEqual(0.04);
  });

  it('rests within a couple of bars once the kick stops', () => {
    const kicks = kicksAt(128, 0.2, 6);
    const { beats } = play(kicks, 12);
    const last = kicks[kicks.length - 1];
    expect(beats.filter((b) => b > last + 2 * 4 * (60 / 128))).toEqual([]);
  });

  it('pulses at full on a beat and dies away before the next', () => {
    const kicks = kicksAt(128, 0.2, 6);
    const { readings } = play(kicks, 6);
    const onBeat = readings.filter(({ reading }) => reading.beat);
    for (const { reading } of onBeat) expect(reading.pulse).toBe(1);
    const between = readings.find(({ timeS }) => timeS > 4.2 && timeS - 4.2 < FRAME_S);
    expect(between?.reading.pulse ?? 1).toBeLessThan(1);
  });

  it('never beats faster than three times a second, however fast the kicks come', () => {
    const { beats } = play(kicksAt(300, 0, 6), 6);
    const gaps = beats.slice(1).map((beat, i) => beat - beats[i]);
    for (const gap of gaps) expect(gap).toBeGreaterThanOrEqual(MIN_BEAT_GAP_S);
    expect(MIN_BEAT_GAP_S).toBeGreaterThan(1 / 3);
  });
});
