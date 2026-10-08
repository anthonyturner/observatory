import { WebAudioStarmapScore } from './starmap-score';

/** An audio context that records what is started and plays nothing. */
function fakeAudio() {
  const started: { at: number }[] = [];
  const param = (initial = 0) => ({
    value: initial,
    setValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
    setTargetAtTime: vi.fn(),
    cancelScheduledValues: vi.fn(),
  });
  const node = (extra: object = {}) => {
    const self: Record<string, unknown> = {
      gain: param(1),
      frequency: param(),
      detune: param(),
      Q: param(),
      threshold: param(),
      ratio: param(),
      delayTime: param(),
      connect: (to: unknown) => to ?? self,
      disconnect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
      ...extra,
    };
    return self;
  };
  const context = {
    currentTime: 10,
    sampleRate: 100,
    state: 'running',
    destination: node(),
    resume: async () => undefined,
    suspend: async () => undefined,
    createGain: () => node(),
    createDynamicsCompressor: () => node(),
    createConvolver: () => node(),
    createBiquadFilter: () => node(),
    createDelay: () => node(),
    createOscillator: () => node(),
    createStereoPanner: () => node({ pan: param() }),
    createBuffer: (channels: number, length: number) => ({
      getChannelData: () => new Float32Array(length),
      numberOfChannels: channels,
    }),
    createBufferSource: () =>
      node({
        start: (at: number) => started.push({ at }),
      }),
  };
  return { context: context as unknown as AudioContext, started };
}

describe('WebAudioStarmapScore crackle', () => {
  it('plays a quiet burst of noise pops once started, after the landing time', async () => {
    const { context, started } = fakeAudio();
    const score = new WebAudioStarmapScore(() => context);
    await score.start();
    const before = started.length;

    score.crackle(0.5, 1, 412);

    const pops = started.slice(before);
    expect(pops.length).toBeGreaterThanOrEqual(3);
    expect(pops.every((pop) => pop.at >= 10)).toBe(true);
    score.stop();
  });

  it('plays nothing before it starts, or after it stops', async () => {
    const { context, started } = fakeAudio();
    const score = new WebAudioStarmapScore(() => context);

    score.crackle(0, 1, 1);
    await score.start();
    const before = started.length;
    score.stop();
    score.crackle(0, 1, 1);

    expect(started.length).toBe(before);
  });
});
