import { BAR_S, BEAT_S, Bar, Ping, barAt, hz } from './ambient-score';
import { Chime, chimesFor, homeMotif } from './home-chimes';
import { bass, pluck } from './instruments';
import { WorldVoice } from './orrery-score';
import { Rig, RoomShape, buildRig, envelope, fadeTo, playFor } from './sound-rig';
import { GrooveHit, grooveFor } from './trance-groove';
import { clap, hat, kick, pumpingPad, supersawPluck } from './trance-instruments';

/** What Home's score listens to, read afresh every bar. */
export interface HomeListening {
  /** The projects on the ring, worst first. Empty until they are read. */
  voices(): readonly WorldVoice[];
  /** The lit project, whose motif plays when it changes. */
  lit(): string | null;
}

const NOBODY: HomeListening = { voices: () => [], lit: () => null };
/** A chime rings this many times longer than the same instrument's pluck on the Orrery. */
const CHIME_RING = 3;
const MOTIF_LEAD_S = 0.05;

/** Plays the ambient score. Behind an interface so the preference can be
 *  tested without an audio device. */
export interface AmbientPlayer {
  /** Resolves once audio is running; browsers allow that only after a gesture. */
  start(): Promise<void>;
  stop(): void;
  /** Stops at once and frees the audio device: the page is going. */
  dispose(): void;
  /** How uneasy to sound, 0 calm to 1 strained; glides there. A score with
   *  no unease of its own leaves this out. */
  setUnease?(level: number): void;
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
/** A tighter room than an ambient score's, so the beat stays crisp, and a
 *  dotted-eighth echo on the tempo: the arpeggio's trance ripple. */
const HOME_ROOM: RoomShape = {
  reverbS: 3.2,
  reverbDecay: 2.6,
  wet: 0.35,
  echoS: BEAT_S * 0.75,
  echoFeedback: 0.38,
  echoFloorHz: 600,
  echoLevel: 1,
  outLevel: 1,
};
const PAD_LEVEL = 0.02;
const ARP_DECAY_S = BEAT_S * 0.4;
/** An inharmonic partial is what makes a sine read as struck glass. */
const BELL_PARTIAL = 2.76;
const PING_DECAY_S = 3.2;
const SWEEP_LEVEL = 0.02;
/* The uneasy layer: a tritone and a minor ninth over the root, low and
   filtered, wavering. Quiet at its loudest: it should be felt more than heard. */
const UNEASE_INTERVALS = [6, 13] as const;
const UNEASE_MAX_GAIN = 0.05;
const UNEASE_CUTOFF_HZ = 520;
const UNEASE_WAVER_HZ = 0.25;
const UNEASE_WAVER_SPREAD_HZ = 1.5;
const UNEASE_GLIDE_S = 3;

interface Unease {
  stop(): void;
  retune(bar: Bar, at: number): void;
  setLevel(level: number, at: number): void;
}

/** Home's score on the Web Audio API, a trance groove generated live, never a recording. */
export class AmbientSynth implements AmbientPlayer {
  private lastLit: string | null = null;
  private currentBar: Bar | null = null;

  constructor(private readonly listening: HomeListening = NOBODY) {}

  private rig: Rig | null = null;
  private unease: Unease | null = null;
  private uneaseLevel = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private suspendTimer: ReturnType<typeof setTimeout> | null = null;
  private nextBarAt = 0;
  private barIndex = 0;

  async start(): Promise<void> {
    const rig = (this.rig ??= buildRig(HOME_ROOM));
    if (this.suspendTimer) clearTimeout(this.suspendTimer);
    if (rig.context.state === 'suspended') await rig.context.resume();
    this.fadeTo(MASTER_LEVEL, FADE_IN_S);
    if (this.timer) return;
    this.nextBarAt = rig.context.currentTime + 0.1;
    this.barIndex = 0;
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
    this.unease?.stop();
    this.unease = null;
    // Suspending only frees the audio device early; if it fails, it idles silent.
    this.rig?.context.suspend().catch(() => undefined);
  }

  dispose(): void {
    if (this.suspendTimer) clearTimeout(this.suspendTimer);
    this.release();
    // Closing only frees the audio device sooner; if it fails, it idles silent.
    this.rig?.context.close().catch(() => undefined);
    this.rig = null;
  }

  private fadeTo(level: number, seconds: number): void {
    if (this.rig) fadeTo(this.rig, level, seconds);
  }

  private schedule(): void {
    const rig = this.rig;
    if (!rig) return;
    const { context } = rig;
    this.playMotifIfLit(rig);
    // A timer held back past the bar would otherwise play every missed bar at once.
    if (this.nextBarAt < context.currentTime) this.nextBarAt = context.currentTime + 0.1;
    while (this.nextBarAt < context.currentTime + LOOKAHEAD_S) {
      this.playBar(
        rig,
        this.barIndex,
        barAt(this.barIndex, Math.random, this.uneaseLevel),
        this.nextBarAt,
      );
      this.nextBarAt += BAR_S;
      this.barIndex++;
    }
  }

  private playMotifIfLit(rig: Rig): void {
    const lit = this.listening.lit();
    if (lit === this.lastLit) return;
    this.lastLit = lit;
    const voice = this.listening.voices().find((one) => one.key === lit);
    if (!voice || !this.currentBar) return;
    const at = rig.context.currentTime + MOTIF_LEAD_S;
    homeMotif(voice, this.currentBar).forEach((chime) => playChime(rig, chime, at));
  }

  private playBar(rig: Rig, index: number, bar: Bar, at: number): void {
    this.unease?.retune(bar, at);
    const groove = grooveFor(index, bar, this.uneaseLevel);
    pad(rig, bar, groove, at);
    groove.forEach((hit) => playHit(rig, hit, at + hit.offsetS));
    this.currentBar = bar;
    const voices = this.listening.voices();
    // Before the projects are read, the old random pings stand in for them.
    if (voices.length) {
      chimesFor(this.barIndex, bar, voices).forEach((chime) => playChime(rig, chime, at));
    } else {
      bar.pings.forEach((ping) => playPing(rig, ping, at + ping.offsetS));
    }
    if (bar.hasSweep) sweep(rig, at);
  }
}

/** A project's chime: its severity's instrument, ringing long and soft. */
function playChime(rig: Rig, chime: Chime, barAt: number): void {
  pluck(rig, {
    at: barAt + chime.offsetS,
    midi: chime.midi,
    severity: chime.severity,
    pan: chime.pan,
    level: chime.level,
    ring: CHIME_RING,
  });
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

/** A bar-long supersaw chord, pumping on every kick. */
function pad(rig: Rig, bar: Bar, groove: readonly GrooveHit[], at: number): void {
  pumpingPad(rig, {
    at,
    notes: bar.pad,
    level: PAD_LEVEL,
    lengthS: BAR_S,
    beats: groove.filter((hit) => hit.kind === 'kick').map((hit) => hit.offsetS),
  });
}

/** One hit of the groove, in its instrument. */
function playHit(rig: Rig, hit: GrooveHit, at: number): void {
  switch (hit.kind) {
    case 'kick':
      kick(rig, at, hit.level);
      return;
    case 'clap':
      clap(rig, at, hit.level);
      return;
    case 'hat':
      hat(rig, at, hit.level, hit.open);
      return;
    case 'bass':
      bass(rig, at, hit.midi, BEAT_S / 4);
      return;
    case 'arp':
      supersawPluck(rig, {
        at,
        midi: hit.midi,
        level: hit.level,
        pan: hit.pan,
        decay: ARP_DECAY_S,
      });
      return;
  }
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

/** A band of noise rising across the whole bar: the riser into the next chord. */
function sweep({ context, bus, noise }: Rig, at: number): void {
  const source = context.createBufferSource();
  source.buffer = noise;
  source.loop = true;
  const filter = context.createBiquadFilter();
  filter.type = 'bandpass';
  filter.Q.value = 6;
  filter.frequency.setValueAtTime(300, at);
  filter.frequency.exponentialRampToValueAtTime(6000, at + BAR_S);
  const gain = envelope(context, {
    at,
    attack: BAR_S * 0.95,
    level: SWEEP_LEVEL,
    end: at + BAR_S,
  });
  source.connect(filter).connect(gain).connect(bus);
  playFor([source], [filter, gain], { at, end: at + BAR_S + 0.05 });
}
