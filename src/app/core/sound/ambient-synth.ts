import { BAR_S, BREATH_S, Bar, Ping, barAt, hz } from './ambient-score';

/** Plays the ambient score. Behind an interface so the preference can be
 *  tested without an audio device. */
export interface AmbientPlayer {
  /** Resolves once audio is running; browsers allow that only after a gesture. */
  start(): Promise<void>;
  stop(): void;
  /** How uneasy to sound, 0 calm to 1 strained; glides there. */
  setUnease(level: number): void;
}

/** Bars are written this far ahead on the audio clock, so a busy page or a
 *  throttled background tab never leaves a gap. */
const LOOKAHEAD_S = 2;
const TICK_MS = 500;
const FADE_IN_S = 2.5;
const FADE_OUT_S = 0.8;
/** How long after fading out the audio device is released. */
const SUSPEND_AFTER_MS = 4000;
const MASTER_LEVEL = 0.9;
const REVERB_S = 5;
const WET = 0.55;
/** A dotted-eighth echo at a slow pulse: pings travel rather than repeat. */
const ECHO_S = 0.75;
const ECHO_FEEDBACK = 0.42;
const PAD_LEVEL = 0.03;
const PAD_DETUNE_CENTS = 8;
const PAD_CUTOFF_HZ = 700;
const DRONE_LEVEL = 0.07;
const DRONE_CUTOFF_HZ = 220;
const DRONE_BREATH_HZ = 140;
/** An inharmonic partial is what makes a sine read as struck glass. */
const BELL_PARTIAL = 2.76;
const PING_DECAY_S = 3.2;
const SWEEP_LEVEL = 0.012;
const SILENT = 0.0001;
/* The uneasy layer: a tritone and a minor ninth over the root, low and
   filtered, wavering. Quiet at its loudest: it should be felt more than heard. */
const UNEASE_INTERVALS = [6, 13] as const;
const UNEASE_MAX_GAIN = 0.05;
const UNEASE_CUTOFF_HZ = 520;
const UNEASE_WAVER_HZ = 0.25;
const UNEASE_WAVER_SPREAD_HZ = 1.5;
const UNEASE_GLIDE_S = 3;

/** The audio graph every note plays into. */
interface Rig {
  readonly context: AudioContext;
  readonly master: GainNode;
  /** Dry and into the reverb. */
  readonly bus: AudioNode;
  /** Into the echo, for the pings. */
  readonly echo: AudioNode;
  readonly noise: AudioBuffer;
}

interface Drone {
  stop(): void;
  retune(bar: Bar, at: number): void;
}

interface Unease extends Drone {
  setLevel(level: number, at: number): void;
}

/** The ambient score on the Web Audio API: generated live, never a recording. */
export class AmbientSynth implements AmbientPlayer {
  private rig: Rig | null = null;
  private drone: Drone | null = null;
  private unease: Unease | null = null;
  private uneaseLevel = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private suspendTimer: ReturnType<typeof setTimeout> | null = null;
  private nextBarAt = 0;
  private barIndex = 0;

  async start(): Promise<void> {
    const rig = (this.rig ??= buildRig());
    if (this.suspendTimer) clearTimeout(this.suspendTimer);
    if (rig.context.state === 'suspended') await rig.context.resume();
    this.fadeTo(MASTER_LEVEL, FADE_IN_S);
    if (this.timer) return;
    this.nextBarAt = rig.context.currentTime + 0.1;
    this.barIndex = 0;
    this.drone = startDrone(rig);
    this.unease = startUnease(rig);
    this.unease.setLevel(this.uneaseLevel, rig.context.currentTime);
    this.timer = setInterval(() => this.schedule(), TICK_MS);
    this.schedule();
  }

  setUnease(level: number): void {
    this.uneaseLevel = level;
    if (this.rig) this.unease?.setLevel(level, this.rig.context.currentTime);
  }

  stop(): void {
    if (!this.rig) return;
    this.fadeTo(0, FADE_OUT_S);
    this.suspendTimer = setTimeout(() => this.release(), SUSPEND_AFTER_MS);
  }

  private release(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.drone?.stop();
    this.drone = null;
    this.unease?.stop();
    this.unease = null;
    // Suspending only frees the audio device early; if it fails, it idles silent.
    this.rig?.context.suspend().catch(() => undefined);
  }

  private fadeTo(level: number, seconds: number): void {
    if (!this.rig) return;
    const { context, master } = this.rig;
    master.gain.cancelScheduledValues(context.currentTime);
    master.gain.setTargetAtTime(level, context.currentTime, seconds / 3);
  }

  private schedule(): void {
    const rig = this.rig;
    if (!rig) return;
    const { context } = rig;
    // A timer held back past the bar would otherwise play every missed bar at once.
    if (this.nextBarAt < context.currentTime) this.nextBarAt = context.currentTime + 0.1;
    while (this.nextBarAt < context.currentTime + LOOKAHEAD_S) {
      this.playBar(rig, barAt(this.barIndex, Math.random, this.uneaseLevel), this.nextBarAt);
      this.nextBarAt += BAR_S;
      this.barIndex++;
    }
  }

  private playBar(rig: Rig, bar: Bar, at: number): void {
    this.drone?.retune(bar, at);
    this.unease?.retune(bar, at);
    pad(rig, bar, at);
    bar.pings.forEach((ping) => playPing(rig, ping, at + ping.offsetS));
    if (bar.hasSweep) sweep(rig, at);
  }
}

/** The room: reverb for everything, an echo for the pings, a limiter last. */
function buildRig(): Rig {
  const context = new AudioContext();
  const master = context.createGain();
  master.gain.value = 0;
  const limiter = context.createDynamicsCompressor();
  limiter.threshold.value = -14;
  limiter.ratio.value = 8;
  master.connect(limiter).connect(context.destination);

  const reverb = context.createConvolver();
  reverb.buffer = decayingNoise(context, REVERB_S);
  const wet = context.createGain();
  wet.gain.value = WET;
  reverb.connect(wet).connect(master);
  const bus = context.createGain();
  bus.connect(master);
  bus.connect(reverb);

  const delay = context.createDelay(2);
  delay.delayTime.value = ECHO_S;
  const feedback = context.createGain();
  feedback.gain.value = ECHO_FEEDBACK;
  const airy = context.createBiquadFilter();
  airy.type = 'highpass';
  airy.frequency.value = 600;
  delay.connect(airy).connect(feedback).connect(delay);
  delay.connect(bus);

  return { context, master, bus, echo: delay, noise: whiteNoise(context) };
}

/** Two sines an octave apart through a filter that opens and closes with the core's breath. */
function startDrone({ context, bus }: Rig): Drone {
  const filter = context.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = DRONE_CUTOFF_HZ;
  const breath = context.createOscillator();
  breath.frequency.value = 1 / BREATH_S;
  const depth = context.createGain();
  depth.gain.value = DRONE_BREATH_HZ;
  breath.connect(depth).connect(filter.frequency);
  const gain = context.createGain();
  gain.gain.value = DRONE_LEVEL;
  filter.connect(gain).connect(bus);
  const voices = [0, 12].map((octave) => {
    const oscillator = context.createOscillator();
    oscillator.type = octave ? 'sawtooth' : 'sine';
    oscillator.connect(filter);
    return { oscillator, octave };
  });
  [breath, ...voices.map((voice) => voice.oscillator)].forEach((node) => node.start());
  return {
    stop: () => [breath, ...voices.map((voice) => voice.oscillator)].forEach((node) => node.stop()),
    retune: (bar, at) =>
      voices.forEach(({ oscillator, octave }) =>
        oscillator.frequency.setTargetAtTime(hz(bar.root + octave), at, 1.5),
      ),
  };
}

/** The uneasy layer under the score, silent while calm. Its loudness and its
 *  waver both follow the level, so strain is heard as restlessness. */
function startUnease({ context, bus }: Rig): Unease {
  const filter = context.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = UNEASE_CUTOFF_HZ;
  const waver = context.createGain();
  const wobble = context.createOscillator();
  wobble.frequency.value = UNEASE_WAVER_HZ;
  const wobbleDepth = context.createGain();
  wobbleDepth.gain.value = 0.5;
  wobble.connect(wobbleDepth).connect(waver.gain);
  waver.gain.value = 0.5;
  const level = context.createGain();
  level.gain.value = 0;
  filter.connect(waver).connect(level).connect(bus);
  const voices = UNEASE_INTERVALS.map((interval) => {
    const oscillator = context.createOscillator();
    oscillator.type = 'sawtooth';
    oscillator.connect(filter);
    return { oscillator, interval };
  });
  const sources = [wobble, ...voices.map((voice) => voice.oscillator)];
  sources.forEach((source) => source.start());
  return {
    stop: () => sources.forEach((source) => source.stop()),
    retune: (bar, at) =>
      voices.forEach(({ oscillator, interval }) =>
        oscillator.frequency.setTargetAtTime(hz(bar.root + 12 + interval), at, 1.5),
      ),
    setLevel: (value, at) => {
      level.gain.setTargetAtTime(UNEASE_MAX_GAIN * Math.pow(value, 1.3), at, UNEASE_GLIDE_S / 3);
      wobble.frequency.setTargetAtTime(
        UNEASE_WAVER_HZ + value * UNEASE_WAVER_SPREAD_HZ,
        at,
        UNEASE_GLIDE_S / 3,
      );
    },
  };
}

/** A bar-long chord of detuned saws, swelling in and overlapping the next. */
function pad({ context, bus }: Rig, bar: Bar, at: number): void {
  const filter = context.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = PAD_CUTOFF_HZ;
  const gain = envelope(context, {
    at,
    attack: BAR_S * 0.4,
    level: PAD_LEVEL,
    end: at + BAR_S * 1.3,
  });
  filter.connect(gain).connect(bus);
  const oscillators = bar.pad.flatMap((midi) =>
    [-PAD_DETUNE_CENTS, PAD_DETUNE_CENTS].map((detune) => {
      const oscillator = context.createOscillator();
      oscillator.type = 'sawtooth';
      oscillator.frequency.value = hz(midi);
      oscillator.detune.value = detune;
      oscillator.connect(filter);
      return oscillator;
    }),
  );
  playFor(oscillators, [filter, gain], { at, end: at + BAR_S * 1.35 });
}

/** One struck-glass note, panned, into the room and the echo. */
function playPing({ context, bus, echo }: Rig, ping: Ping, at: number): void {
  const gain = envelope(context, { at, attack: 0.01, level: ping.level, end: at + PING_DECAY_S });
  const pan = context.createStereoPanner();
  pan.pan.value = ping.pan;
  gain.connect(pan);
  pan.connect(bus);
  pan.connect(echo);
  const partial = context.createGain();
  partial.gain.value = 0.3;
  partial.connect(gain);
  const tones = [
    { frequency: hz(ping.midi), into: gain },
    { frequency: hz(ping.midi) * BELL_PARTIAL, into: partial },
  ].map(({ frequency, into }) => {
    const oscillator = context.createOscillator();
    oscillator.frequency.value = frequency;
    oscillator.connect(into);
    return oscillator;
  });
  playFor(tones, [gain, pan, partial], { at, end: at + PING_DECAY_S + 0.1 });
}

/** A quiet band of noise rising across the bar: the scanner. */
function sweep({ context, bus, noise }: Rig, at: number): void {
  const source = context.createBufferSource();
  source.buffer = noise;
  source.loop = true;
  const filter = context.createBiquadFilter();
  filter.type = 'bandpass';
  filter.Q.value = 6;
  filter.frequency.setValueAtTime(300, at);
  filter.frequency.exponentialRampToValueAtTime(3800, at + BAR_S * 0.8);
  const gain = envelope(context, {
    at,
    attack: BAR_S * 0.4,
    level: SWEEP_LEVEL,
    end: at + BAR_S * 0.85,
  });
  source.connect(filter).connect(gain).connect(bus);
  playFor([source], [filter, gain], { at, end: at + BAR_S * 0.9 });
}

interface Envelope {
  readonly at: number;
  readonly attack: number;
  readonly level: number;
  readonly end: number;
}

function envelope(context: AudioContext, { at, attack, level, end }: Envelope): GainNode {
  const gain = context.createGain();
  gain.gain.setValueAtTime(SILENT, at);
  gain.gain.exponentialRampToValueAtTime(level, at + attack);
  gain.gain.exponentialRampToValueAtTime(SILENT, end);
  return gain;
}

/** Starts the sources and unhooks everything once the last one ends. Left
 *  connected, finished notes pile up in the graph and the audio thread keeps
 *  working through them until the score crackles. */
function playFor(
  sources: readonly AudioScheduledSourceNode[],
  nodes: readonly AudioNode[],
  { at, end }: { at: number; end: number },
): void {
  let playing = sources.length;
  sources.forEach((source) => {
    source.onended = () => {
      playing--;
      if (playing === 0) [...sources, ...nodes].forEach((node) => node.disconnect());
    };
    source.start(at);
    source.stop(end);
  });
}

/** A room made of decaying noise: a few seconds of it reads as space. */
function decayingNoise(context: AudioContext, seconds: number): AudioBuffer {
  const length = Math.floor(context.sampleRate * seconds);
  const buffer = context.createBuffer(2, length, context.sampleRate);
  for (let channel = 0; channel < 2; channel++) {
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < length; i++)
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2.4);
  }
  return buffer;
}

function whiteNoise(context: AudioContext): AudioBuffer {
  const buffer = context.createBuffer(1, context.sampleRate, context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}
