import { NOVA_S } from '../memory/merge-supernova';
import { WebAudioStarmapScore } from './starmap-score';

/** A stand-in for the audio device: it records what is started and where it is panned. */
function fakeAudio() {
  const starts: number[] = [];
  const pans: number[] = [];
  const param = () => ({
    value: 0,
    setValueAtTime: () => undefined,
    linearRampToValueAtTime: () => undefined,
    exponentialRampToValueAtTime: () => undefined,
    setTargetAtTime: () => undefined,
    cancelScheduledValues: () => undefined,
  });
  const node = (extra: object = {}) => {
    const self: Record<string, unknown> = {
      connect: (to: unknown) => to,
      disconnect: () => undefined,
      gain: param(),
      frequency: param(),
      detune: param(),
      Q: param(),
      threshold: param(),
      ratio: param(),
      delayTime: param(),
      start: (at?: number) => void starts.push(at ?? 0),
      stop: () => undefined,
      ...extra,
    };
    return self;
  };
  const context = {
    state: 'running',
    currentTime: 10,
    sampleRate: 100,
    destination: node(),
    resume: async () => undefined,
    suspend: async () => undefined,
    createGain: () => node(),
    createOscillator: () => node(),
    createBiquadFilter: () => node(),
    createBufferSource: () => node(),
    createDynamicsCompressor: () => node(),
    createConvolver: () => node(),
    createDelay: () => node(),
    createBuffer: (_channels: number, length: number) => ({
      getChannelData: () => new Float32Array(length),
    }),
    createStereoPanner: () => {
      const pan = param();
      pans.push(0);
      const index = pans.length - 1;
      return node({
        pan: {
          ...pan,
          set value(v: number) {
            pans[index] = v;
          },
        },
      });
    },
  };
  return { context: context as unknown as AudioContext, starts, pans };
}

describe('WebAudioStarmapScore.merge', () => {
  it('plays a boom and a shimmer, panned and after the delay, once the score is on', async () => {
    const { context, starts, pans } = fakeAudio();
    const score = new WebAudioStarmapScore(() => context);
    await score.start();
    const before = starts.length;

    score.merge({ delayS: 0.5, pan: -0.6, whoosh: [] });

    const played = starts.slice(before);
    expect(played.length).toBeGreaterThan(2);
    expect(played.every((at) => at >= 10.5)).toBe(true);
    expect(Math.min(...played)).toBe(10.5);
    expect(pans.length).toBeGreaterThan(2);
    expect(pans.every((pan) => pan === -0.6)).toBe(true);
    score.stop();
  });

  it('plays nothing before it starts or after it stops', async () => {
    const { context, starts } = fakeAudio();
    const score = new WebAudioStarmapScore(() => context);

    score.merge({ delayS: 0, pan: 0, whoosh: [] });
    expect(starts).toEqual([]);

    await score.start();
    score.stop();
    const after = starts.length;
    score.merge({ delayS: 0, pan: 0, whoosh: [] });
    expect(starts.length).toBe(after);
  });
});

describe('WebAudioStarmapScore.merge whoosh', () => {
  const path = [
    { at: 0.5, pan: -0.5, doppler: 1.1 },
    { at: 1.5, pan: 0.5, doppler: 0.9 },
  ];

  it('adds a noise whoosh after the supernova, only when the cue has a streak', async () => {
    const { context, starts } = fakeAudio();
    const score = new WebAudioStarmapScore(() => context);
    await score.start();
    const before = starts.length;
    score.merge({ delayS: 0, pan: 0, whoosh: [] });
    const without = starts.length - before;

    score.merge({ delayS: 1, pan: 0, whoosh: path });
    const withStreak = starts.slice(before + without);

    expect(withStreak.length).toBe(without + 1);
    expect(withStreak).toContain(10 + 1 + NOVA_S);
    score.stop();
  });

  it('glides its filter and pan along the path, pitched by each stop’s Doppler factor', async () => {
    const { context, starts } = fakeAudio();
    const ramps: [string, number, number][] = [];
    const real = context.createBiquadFilter.bind(context);
    context.createBiquadFilter = () => {
      const filter = real() as unknown as { frequency: Record<string, unknown>; type?: string };
      filter.frequency['setValueAtTime'] = (value: number, at: number) =>
        void ramps.push(['set', value, at]);
      filter.frequency['linearRampToValueAtTime'] = (value: number, at: number) =>
        void ramps.push(['ramp', value, at]);
      return filter as unknown as BiquadFilterNode;
    };
    const score = new WebAudioStarmapScore(() => context);
    await score.start();
    ramps.length = 0;

    score.merge({ delayS: 0, pan: 0, whoosh: path });

    const [set, ramp] = ramps.filter(([, , at]) => at >= 10 + NOVA_S);
    expect(set[1]).toBeGreaterThan(ramp[1]);
    expect(ramp[1] / set[1]).toBeCloseTo(0.9 / 1.1);
    expect(ramp[2]).toBeCloseTo(10 + NOVA_S + 1.5);
    expect(starts.length).toBeGreaterThan(0);
    score.stop();
  });
});

describe('WebAudioStarmapScore.crackle', () => {
  it('plays a quiet burst of noise pops once started, after the landing time, panned', async () => {
    const { context, starts, pans } = fakeAudio();
    const score = new WebAudioStarmapScore(() => context);
    await score.start();
    const before = starts.length;
    pans.length = 0;

    score.crackle(0.5, 1, 412);

    const played = starts.slice(before);
    expect(played.length).toBeGreaterThanOrEqual(3);
    expect(played.every((at) => at >= 10)).toBe(true);
    expect(pans.length).toBe(played.length);
    expect(pans.every((pan) => pan === 0.5)).toBe(true);
    score.stop();
  });

  it('pitches its pops by the Doppler factor, and leaves them alone by default', async () => {
    const { context } = fakeAudio();
    const freqs: number[] = [];
    const real = context.createBiquadFilter.bind(context);
    context.createBiquadFilter = () => {
      const filter = real() as unknown as { frequency: Record<string, unknown> };
      filter.frequency['setValueAtTime'] = (value: number) => void freqs.push(value);
      return filter as unknown as BiquadFilterNode;
    };
    const score = new WebAudioStarmapScore(() => context);
    await score.start();
    const pops = (doppler?: number): number[] => {
      freqs.length = 0;
      score.crackle(0, 1, 412, doppler);
      return [...freqs];
    };

    const plain = pops();
    const shifted = pops(1.2);

    expect(plain.length).toBeGreaterThanOrEqual(3);
    expect(shifted).toEqual(plain.map((f) => f * 1.2));
    score.stop();
  });

  it('plays nothing before it starts, or after it stops', async () => {
    const { context, starts } = fakeAudio();
    const score = new WebAudioStarmapScore(() => context);

    score.crackle(0, 1, 1);
    expect(starts).toEqual([]);

    await score.start();
    score.stop();
    const after = starts.length;
    score.crackle(0, 1, 1);

    expect(starts.length).toBe(after);
  });
});
