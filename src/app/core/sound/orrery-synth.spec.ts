import { OrreryListening, OrrerySynth } from './orrery-synth';
import { ArrivalCue } from './orrery-score';
import { FLIGHT_S, LAUNCH_LAG_S } from '../orrery/merge-arrival';

/** A stand-in for the audio device: it records when each source starts and where it is panned. */
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
  class FakeAudioContext {
    state = 'running';
    currentTime = 10;
    sampleRate = 100;
    destination = node();
    resume = async () => undefined;
    suspend = async () => undefined;
    close = async () => undefined;
    createGain = () => node();
    createOscillator = () => node();
    createBiquadFilter = () => node();
    createBufferSource = () => node();
    createDynamicsCompressor = () => node();
    createConvolver = () => node();
    createDelay = () => node();
    createBuffer = (_channels: number, length: number) => ({
      getChannelData: () => new Float32Array(length),
    });
    createStereoPanner = () => {
      const index = pans.push(0) - 1;
      return node({
        pan: {
          ...param(),
          set value(v: number) {
            pans[index] = v;
          },
          setValueAtTime: (v: number) => void (pans[index] = v),
        },
      });
    };
  }
  return { FakeAudioContext, starts, pans };
}

function listening(arrivals: () => readonly ArrivalCue[] = () => []): OrreryListening {
  return {
    system: () => ({ voices: [], totalOpen: 0, blocked: 0 }),
    picked: () => null,
    isHidden: () => false,
    arrivals,
  };
}

describe('OrrerySynth merge sounds', () => {
  let audio: ReturnType<typeof fakeAudio>;

  beforeEach(() => {
    audio = fakeAudio();
    vi.stubGlobal('AudioContext', audio.FakeAudioContext);
  });

  afterEach(() => vi.unstubAllGlobals());

  it('lightDims plays one falling tone at the world’s pan, after the delay', async () => {
    const synth = new OrrerySynth(listening());
    await synth.start();
    const [before, panned] = [audio.starts.length, audio.pans.length];

    synth.lightDims(-0.4, 0.5);

    expect(audio.starts.slice(before)).toEqual([10.5]);
    expect(audio.pans.slice(panned)).toEqual([-0.4]);
    synth.dispose();
  });

  it('speckFlies glides a noise band from one side to the other for the whole flight', async () => {
    const synth = new OrrerySynth(listening());
    await synth.start();
    const [before, panned] = [audio.starts.length, audio.pans.length];

    synth.speckFlies(-0.5, 0.6, FLIGHT_S, LAUNCH_LAG_S);

    expect(audio.starts.slice(before)).toEqual([10 + LAUNCH_LAG_S]);
    expect(audio.pans.slice(panned)).toEqual([-0.5]);
    synth.dispose();
  });

  it('speckLands rings one small bell at the landing pan', async () => {
    const synth = new OrrerySynth(listening());
    await synth.start();
    const [before, panned] = [audio.starts.length, audio.pans.length];

    synth.speckLands(0.6, 3);

    expect(audio.starts.slice(before).every((at) => at === 13)).toBe(true);
    expect(audio.starts.length).toBeGreaterThan(before);
    expect(audio.pans.slice(panned)).toEqual([0.6]);
    synth.dispose();
  });

  it('makes no sound before the score has started', () => {
    const synth = new OrrerySynth(listening());

    synth.lightDims(0);
    synth.speckFlies(0, 0, 1);
    synth.speckLands(0);

    expect(audio.starts).toEqual([]);
  });

  it('plays a marked merge once on the next tick, and drops those marked while it was off', async () => {
    vi.useFakeTimers();
    try {
      const marked: ArrivalCue[] = [{ fromPan: 0.1, toPan: 0.2 }];
      let asked = 0;
      const synth = new OrrerySynth(
        listening(() => {
          asked++;
          return marked.splice(0);
        }),
      );
      await synth.start();
      expect(marked).toEqual([]);
      expect(asked).toBe(1);
      const before = audio.starts.length;

      marked.push({ fromPan: -0.3, toPan: 0.3 });
      vi.advanceTimersByTime(30);

      const played = audio.starts.slice(before);
      expect(played).toContain(10);
      expect(played).toContain(10 + LAUNCH_LAG_S);
      expect(played).toContain(10 + LAUNCH_LAG_S + FLIGHT_S);
      synth.dispose();
    } finally {
      vi.useRealTimers();
    }
  });
});
