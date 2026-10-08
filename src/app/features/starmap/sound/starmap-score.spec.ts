import type { ClipBytes } from './space-bed';
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

    score.merge({ delayS: 0.5, pan: -0.6 });

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

    score.merge({ delayS: 0, pan: 0 });
    expect(starts).toEqual([]);

    await score.start();
    score.stop();
    const after = starts.length;
    score.merge({ delayS: 0, pan: 0 });
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

describe('WebAudioStarmapScore space bed', () => {
  function withBed() {
    const { context, starts } = fakeAudio();
    const recording = {};
    const played: unknown[] = [];
    const heard = {
      ...context,
      decodeAudioData: async () => recording,
      createBufferSource: () => {
        const source = {
          buffer: null as unknown,
          loop: false,
          connect: (to: unknown) => to,
          start: () => {
            if (source.buffer === recording) played.push(source);
          },
        };
        return source;
      },
    } as unknown as AudioContext;
    const bytes = vi.fn<ClipBytes>(async () => new ArrayBuffer(8));
    return { score: new WebAudioStarmapScore(() => heard, bytes), bytes, played, starts };
  }

  it('loads the recordings only once the sound is turned on', async () => {
    const { score, bytes, played } = withBed();
    score.setOpen(6);
    expect(bytes).not.toHaveBeenCalled();

    await score.start();
    await new Promise((resolve) => setTimeout(resolve));

    expect(bytes.mock.calls.length).toBeGreaterThan(1);
    expect(played.length).toBe(bytes.mock.calls.length);
    score.stop();
  });

  it('plays on without the recordings when they cannot be loaded', async () => {
    const { context } = fakeAudio();
    const score = new WebAudioStarmapScore(
      () => context,
      async () => {
        throw new Error('offline');
      },
    );

    await expect(score.start()).resolves.toBeUndefined();
    score.setOpen(3);
    score.stop();
  });
});
