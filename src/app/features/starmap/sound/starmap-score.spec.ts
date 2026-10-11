import { COOL_S, SINK_S } from '../memory/closed-ember';
import { NOVA_S } from '../memory/merge-supernova';
import { COLLAPSE_S } from '../memory/squash-collapse';
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

describe('WebAudioStarmapScore.implode', () => {
  const path = [
    { at: 0.5, pan: -0.5, doppler: 1.1 },
    { at: 1.5, pan: 0.5, doppler: 0.9 },
  ];

  it('sweeps in over the collapse, then snaps and whooshes as the star flashes', async () => {
    const { context, starts } = fakeAudio();
    const score = new WebAudioStarmapScore(() => context);
    await score.start();
    const before = starts.length;

    score.implode({ delayS: 1, pan: 0.3, sweeps: true, whoosh: path });

    const played = starts.slice(before);
    const flash = 10 + 1 + COLLAPSE_S;
    expect(played).toContain(11);
    expect(played.filter((at) => at === flash).length).toBeGreaterThanOrEqual(4);
    expect(played.every((at) => at >= 11)).toBe(true);
    score.stop();
  });

  it('keeps only the snap when the collapse does not move', async () => {
    const { context, starts } = fakeAudio();
    const score = new WebAudioStarmapScore(() => context);
    await score.start();
    const before = starts.length;

    score.implode({ delayS: 1, pan: 0.3, sweeps: false, whoosh: [] });

    const played = starts.slice(before);
    expect(played.length).toBeGreaterThanOrEqual(3);
    expect(played.every((at) => at === 10 + 1 + COLLAPSE_S)).toBe(true);
    score.stop();
  });

  it('pans its snap by the cue', async () => {
    const { context, pans } = fakeAudio();
    const score = new WebAudioStarmapScore(() => context);
    await score.start();
    pans.length = 0;

    score.implode({ delayS: 0, pan: -0.6, sweeps: true, whoosh: [] });

    expect(pans.length).toBeGreaterThan(2);
    expect(pans.every((pan) => pan === -0.6)).toBe(true);
    score.stop();
  });

  it('plays nothing before it starts or after it stops', async () => {
    const { context, starts } = fakeAudio();
    const score = new WebAudioStarmapScore(() => context);

    score.implode({ delayS: 0, pan: 0, sweeps: true, whoosh: [] });
    expect(starts).toEqual([]);

    await score.start();
    score.stop();
    const after = starts.length;
    score.implode({ delayS: 0, pan: 0, sweeps: true, whoosh: [] });
    expect(starts.length).toBe(after);
  });
});

describe('WebAudioStarmapScore.sink', () => {
  const path = [
    { at: 0.4, pan: 0.5, doppler: 1 },
    { at: 1.4, pan: -0.2, doppler: 1 },
  ];

  it('hushes as the star cools, then breathes low as it sinks, then thuds as the hole takes it', async () => {
    const { context, starts } = fakeAudio();
    const score = new WebAudioStarmapScore(() => context);
    await score.start();
    const before = starts.length;

    score.sink({ delayS: 1, pan: 0.5, sink: path });

    const played = starts.slice(before);
    expect(played).toContain(11);
    expect(played).toContain(11 + COOL_S);
    expect(played).toContain(11 + COOL_S + SINK_S);
    expect(played.every((at) => at >= 11)).toBe(true);
    score.stop();
  });

  it('only cools when motion is off, since nothing sinks', async () => {
    const { context, starts } = fakeAudio();
    const score = new WebAudioStarmapScore(() => context);
    await score.start();
    const before = starts.length;

    score.sink({ delayS: 1, pan: 0.5, sink: [] });

    const played = starts.slice(before);
    expect(played.length).toBeGreaterThan(0);
    expect(played.every((at) => at < 11 + COOL_S)).toBe(true);
    score.stop();
  });

  it('lets the breath fall in pitch along the path, bent by each stop�s Doppler factor', async () => {
    const { context } = fakeAudio();
    const freqs: [number, number][] = [];
    const real = context.createBiquadFilter.bind(context);
    context.createBiquadFilter = () => {
      const filter = real() as unknown as { frequency: Record<string, unknown> };
      filter.frequency['setValueAtTime'] = (value: number, at: number) =>
        void freqs.push([value, at]);
      filter.frequency['linearRampToValueAtTime'] = (value: number, at: number) =>
        void freqs.push([value, at]);
      return filter as unknown as BiquadFilterNode;
    };
    const score = new WebAudioStarmapScore(() => context);
    await score.start();
    freqs.length = 0;

    score.sink({ delayS: 0, pan: 0, sink: path });

    const breath = freqs.filter(([, at]) => at >= 10 + COOL_S).map(([value]) => value);
    expect(breath.length).toBe(2);
    expect(breath[1]).toBeLessThan(breath[0]);
    score.stop();
  });

  it('plays nothing before it starts or after it stops', async () => {
    const { context, starts } = fakeAudio();
    const score = new WebAudioStarmapScore(() => context);

    score.sink({ delayS: 0, pan: 0, sink: path });
    expect(starts).toEqual([]);

    await score.start();
    score.stop();
    const after = starts.length;
    score.sink({ delayS: 0, pan: 0, sink: path });
    expect(starts.length).toBe(after);
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

describe('WebAudioStarmapScore.chime', () => {
  it('rings a bell and a quieter octave, panned and after the delay, once the score is on', async () => {
    const { context, starts, pans } = fakeAudio();
    const score = new WebAudioStarmapScore(() => context);
    await score.start();
    const before = starts.length;
    const panners = pans.length;

    score.chime({ delayS: 0.3, pan: -0.4, planet: 1 });

    const played = starts.slice(before);
    expect(played.length).toBeGreaterThanOrEqual(2);
    expect(played.every((at) => at >= 10.3)).toBe(true);
    expect(pans.slice(panners).every((pan) => pan === -0.4)).toBe(true);
    score.stop();
  });

  it('rings a note for every planet, even past the fourth', async () => {
    const { context, starts } = fakeAudio();
    const score = new WebAudioStarmapScore(() => context);
    await score.start();
    const before = starts.length;

    for (const planet of [0, 1, 2, 3, 4]) score.chime({ delayS: 0, pan: 0, planet });

    expect(starts.length).toBeGreaterThan(before);
    score.stop();
  });

  it('plays nothing before it starts or after it stops', async () => {
    const { context, starts } = fakeAudio();
    const score = new WebAudioStarmapScore(() => context);

    score.chime({ delayS: 0, pan: 0, planet: 0 });
    expect(starts).toEqual([]);

    await score.start();
    score.stop();
    const after = starts.length;
    score.chime({ delayS: 0, pan: 0, planet: 0 });
    expect(starts.length).toBe(after);
  });
});

describe('WebAudioStarmapScore.suction', () => {
  it('swells a band of noise, panned and after the delay, once the score is on', async () => {
    const { context, starts, pans } = fakeAudio();
    const score = new WebAudioStarmapScore(() => context);
    await score.start();
    const before = starts.length;
    const panners = pans.length;

    score.suction({ delayS: 0.65, pan: 0.3, strength: 1 });

    expect(starts.slice(before)).toEqual([10.65]);
    expect(pans[panners]).toBe(0.3);
    score.stop();
  });

  it('plays nothing before it starts or after it stops', async () => {
    const { context, starts } = fakeAudio();
    const score = new WebAudioStarmapScore(() => context);

    score.suction({ delayS: 0, pan: 0, strength: 0 });
    expect(starts).toEqual([]);

    await score.start();
    score.stop();
    const after = starts.length;
    score.suction({ delayS: 0, pan: 0, strength: 0 });
    expect(starts.length).toBe(after);
  });
});

describe('WebAudioStarmapScore.undock', () => {
  it('plays a rumble and a whine, panned and after the delay, once the score is on', async () => {
    const { context, starts, pans } = fakeAudio();
    const score = new WebAudioStarmapScore(() => context);
    await score.start();
    const before = starts.length;
    const panners = pans.length;

    score.undock({ kind: 'crew', delayS: 0.4, pan: 0.5 });

    const played = starts.slice(before);
    expect(played).toHaveLength(2);
    expect(played.every((at) => at === 10.4)).toBe(true);
    expect(pans[panners]).toBe(0.5);
    score.stop();
  });

  it('sounds for a satellite as well as a crew', async () => {
    const { context, starts } = fakeAudio();
    const score = new WebAudioStarmapScore(() => context);
    await score.start();
    const before = starts.length;

    score.undock({ kind: 'satellite', delayS: 0, pan: 0 });

    expect(starts.length - before).toBe(2);
    score.stop();
  });

  it('plays nothing before it starts or after it stops', async () => {
    const { context, starts } = fakeAudio();
    const score = new WebAudioStarmapScore(() => context);

    score.undock({ kind: 'crew', delayS: 0, pan: 0 });
    expect(starts).toEqual([]);

    await score.start();
    score.stop();
    const after = starts.length;
    score.undock({ kind: 'crew', delayS: 0, pan: 0 });
    expect(starts.length).toBe(after);
  });
});
