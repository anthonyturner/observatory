import { TestBed } from '@angular/core/testing';
import { StarmapScore, WebAudioStarmapScore, gainFor, tensionGainFor } from './starmap-score';
import { STARMAP_SCORE, StarmapSound } from './starmap-sound';

function fakeScore() {
  const calls: string[] = [];
  const score: StarmapScore = {
    start: async () => void calls.push('start'),
    stop: () => void calls.push('stop'),
    setTension: (n) => void calls.push(`tension ${n}`),
    setVolume: (v) => void calls.push(`volume ${v}`),
    ping: (stuck, pr) => void calls.push(`ping ${stuck} ${pr}`),
    crackle: (pan, strength, seed, doppler) =>
      void calls.push(`crackle ${pan} ${strength} ${seed} ${doppler}`),
    beep: (pan, hz, doppler) => void calls.push(`beep ${pan} ${hz} ${doppler}`),
    merge: ({ delayS, pan }) => void calls.push(`merge ${delayS} ${pan}`),
  };
  return { score, calls };
}

function setUp() {
  const { score, calls } = fakeScore();
  TestBed.configureTestingModule({
    providers: [{ provide: STARMAP_SCORE, useValue: () => score }],
  });
  return { sound: TestBed.inject(StarmapSound), calls };
}

describe('StarmapSound', () => {
  beforeEach(() => localStorage.clear());

  it('is off until asked for, then plays at the remembered volume and tension', () => {
    const { sound, calls } = setUp();
    sound.setTension(3);
    expect(sound.isOn()).toBe(false);

    sound.toggle();

    expect(sound.isOn()).toBe(true);
    expect(calls).toEqual(['volume 0.7', 'tension 3', 'start']);
    expect(localStorage.getItem('observatory.starmap.sound')).toBe('on');
  });

  it('pings a chosen star only while it plays', () => {
    const { sound, calls } = setUp();
    sound.ping(true, 58);
    sound.toggle();
    sound.ping(false, 195);

    expect(calls.filter((c) => c.startsWith('ping'))).toEqual(['ping false 195']);
  });

  it('crackles for a landing meteor only while it plays', () => {
    const { sound, calls } = setUp();
    sound.crackle(-0.4, 0.5, 412);
    sound.toggle();
    sound.crackle(0.6, 1, 7, 1.1);
    sound.toggle();
    sound.crackle(0.1, 1, 8, 1.1);

    expect(calls.filter((c) => c.startsWith('crackle'))).toEqual(['crackle 0.6 1 7 1.1']);
  });

  it('beeps a satellite at its state’s pitch, only while it plays', () => {
    const { sound, calls } = setUp();
    sound.beep(0.5, 'working');
    sound.toggle();
    sound.beep(-0.25, 'working', 1.05);
    sound.beep(0, 'quiet');

    expect(calls.filter((c) => c.startsWith('beep'))).toEqual([
      'beep -0.25 1568 1.05',
      'beep 0 988 1',
    ]);
  });

  it('booms for a merge only while it plays', () => {
    const { sound, calls } = setUp();
    sound.merged({ delayS: 1, pan: -0.5, whoosh: [] });
    sound.toggle();
    sound.merged({ delayS: 0.5, pan: 0.25, whoosh: [] });

    expect(calls.filter((c) => c.startsWith('merge'))).toEqual(['merge 0.5 0.25']);
  });

  it('remembers the volume and fades out when turned off', () => {
    const { sound, calls } = setUp();
    sound.toggle();
    sound.setVolume(0.3);
    sound.toggle();

    expect(localStorage.getItem('observatory.starmap.volume')).toBe('0.3');
    expect(calls.slice(-2)).toEqual(['volume 0.3', 'stop']);
  });
});

describe('the score’s curves', () => {
  it('follows the slider’s square, and tops the tension out at twelve blocked', () => {
    expect(gainFor(0.5)).toBeCloseTo(0.6);
    expect(tensionGainFor(0)).toBe(0);
    expect(tensionGainFor(6)).toBeCloseTo(0.0225);
    expect(tensionGainFor(40)).toBeCloseTo(0.045);
  });
});

/** An audio context that makes no sound: nodes that record what they were told. */
function fakeContext() {
  const made: Record<string, unknown>[] = [];
  const param = () => ({
    value: 0,
    setValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
    cancelScheduledValues: vi.fn(),
    setTargetAtTime: vi.fn(),
  });
  const node = (kind: string, fields: Record<string, unknown> = {}) => {
    const self: Record<string, unknown> = {
      kind,
      connect: (to: unknown) => to,
      start: vi.fn(),
      stop: vi.fn(),
      frequency: param(),
      detune: param(),
      gain: param(),
      pan: param(),
      Q: param(),
      delayTime: param(),
      threshold: param(),
      ratio: param(),
      ...fields,
    };
    made.push(self);
    return self;
  };
  const context = {
    state: 'running',
    currentTime: 3,
    sampleRate: 100,
    destination: {},
    resume: async () => undefined,
    suspend: async () => undefined,
    createBuffer: () => ({ getChannelData: () => new Float32Array(1_000) }),
    createOscillator: () => node('oscillator'),
    createGain: () => node('gain'),
    createBiquadFilter: () => node('filter'),
    createDynamicsCompressor: () => node('compressor'),
    createConvolver: () => node('convolver'),
    createDelay: () => node('delay'),
    createBufferSource: () => node('source'),
    createStereoPanner: () => node('panner'),
  };
  return { context: context as unknown as AudioContext, made };
}

describe('the score’s satellite beep', () => {
  it('makes a short, quiet, panned beep once playing, and none before', async () => {
    const { context, made } = fakeContext();
    const score = new WebAudioStarmapScore(() => context);
    score.beep(0.5, 1568);
    expect(made).toEqual([]);

    await score.start();
    const before = made.length;
    score.beep(0.5, 1568);
    score.stop();

    const added = made.slice(before);
    const panner = added.find((each) => each['kind'] === 'panner');
    const oscillator = added.find((each) => each['kind'] === 'oscillator');
    expect((panner?.['pan'] as { value: number }).value).toBe(0.5);
    expect((oscillator?.['frequency'] as { value: number }).value).toBe(1568);
    const stop = (oscillator?.['stop'] as ReturnType<typeof vi.fn>).mock.calls[0][0] as number;
    expect(stop - 3).toBeLessThan(0.2);
    const level = (
      added.find((each) => each['kind'] === 'gain')?.['gain'] as {
        linearRampToValueAtTime: ReturnType<typeof vi.fn>;
      }
    ).linearRampToValueAtTime.mock.calls[0][0] as number;
    expect(level).toBeLessThanOrEqual(0.05);
  });

  it('pitches the beep by the Doppler factor it is given, and leaves it alone by default', async () => {
    const { context, made } = fakeContext();
    const score = new WebAudioStarmapScore(() => context);
    await score.start();
    const pitchOf = (play: () => void): number => {
      const before = made.length;
      play();
      const oscillator = made.slice(before).find((each) => each['kind'] === 'oscillator');
      return (oscillator?.['frequency'] as { value: number }).value;
    };

    expect(pitchOf(() => score.beep(0, 1000))).toBe(1000);
    expect(pitchOf(() => score.beep(0, 1000, 1.1))).toBeCloseTo(1100);
    expect(pitchOf(() => score.beep(0, 1000, 0.9))).toBeCloseTo(900);
    score.stop();
  });
});
