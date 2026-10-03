import { KickOnsets } from './kick-onsets';

const FRAME_S = 1 / 60;

/** A steady wobble of ±`depth`, the same on every run. */
function noiseOf(depth: number): () => number {
  let state = 12345;
  return () => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return (state / 2147483648 - 0.5) * 2 * depth;
  };
}

/** The kick band over a loud, rolling bassline, with a kick at each of `kickTimes`. */
function kickBand(kickTimes: readonly number[]): (timeS: number) => number {
  const noise = noiseOf(0.02);
  return (timeS) => {
    let level = 0.68 + noise();
    for (const kickS of kickTimes)
      if (timeS >= kickS) level += 0.14 * Math.exp(-(timeS - kickS) / 0.06);
    return Math.min(1, level);
  };
}

function onsetsOf(level: (timeS: number) => number, seconds: number): number[] {
  const kicks = new KickOnsets();
  const onsets: number[] = [];
  for (let t = 0; t < seconds; t += FRAME_S) if (kicks.read(level(t), t)) onsets.push(t);
  return onsets;
}

const steadyKicks = (bpm: number, seconds: number): number[] =>
  Array.from({ length: Math.floor((seconds * bpm) / 60) }, (_, i) => 1 + (i * 60) / bpm);

describe('KickOnsets', () => {
  it('finds each kick of a 4/4 over a loud bassline, within a frame of it', () => {
    const kicks = steadyKicks(138, 9).filter((s) => s < 9);
    const onsets = onsetsOf(kickBand(kicks), 9).filter((s) => s > 0.5);
    const found = kicks.filter((k) => onsets.some((o) => o >= k && o - k <= FRAME_S * 1.5));
    expect(found.length).toBe(kicks.length);
    expect(onsets.length).toBe(kicks.length);
  });

  it('finds nothing in a steady, wobbling bassline once it has settled', () => {
    const onsets = onsetsOf(kickBand([]), 6);
    expect(onsets.filter((s) => s > 1)).toEqual([]);
  });

  it('counts a sustained kick once, however long it rings', () => {
    const onsets = onsetsOf((t) => (t < 1 ? 0.3 : 0.9), 3);
    expect(onsets.filter((s) => s > 0.5).length).toBe(1);
  });
});
