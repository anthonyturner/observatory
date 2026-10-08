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
