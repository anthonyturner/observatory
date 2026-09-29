import { BAR_S, BEAT_S, Bar, barAt } from './ambient-score';
import { melodyFor } from './home-melody';
import { homeMotif } from './home-voices';
import { bass } from './instruments';
import { WorldVoice } from './orrery-score';
import { Rig, RoomShape, buildRig, envelope, fadeTo, playFor } from './sound-rig';
import { GrooveHit, grooveFor } from './trance-groove';
import { clap, hat, kick, lead, pumpingPad, supersawPluck } from './trance-instruments';

/** What Home's score listens to, read afresh every bar. */
export interface HomeListening {
  /** The projects on the ring, worst first. Empty until they are read. */
  voices(): readonly WorldVoice[];
  /** The lit project, whose motif plays when it changes. */
  lit(): string | null;
}

const NOBODY: HomeListening = { voices: () => [], lit: () => null };
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
const SWEEP_LEVEL = 0.02;
const MELODY_LEVEL = 0.045;

/** Home's score on the Web Audio API, a trance groove generated live, never a recording. */
export class AmbientSynth implements AmbientPlayer {
  private lastLit: string | null = null;
  private currentBar: Bar | null = null;

  constructor(private readonly listening: HomeListening = NOBODY) {}

  private rig: Rig | null = null;
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
    this.timer = setInterval(() => this.schedule(), TICK_MS);
    this.schedule();
  }

  /** Heard from the next bar on, as a busier groove. */
  setUnease(level: number): void {
    this.uneaseLevel = level;
  }

  stop(): void {
    if (!this.rig) return;
    this.fadeTo(0, FADE_OUT_S);
    this.suspendTimer = setTimeout(() => this.release(), SUSPEND_AFTER_MS);
  }

  private release(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
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
      this.playBar(rig, this.barIndex, barAt(this.barIndex, this.uneaseLevel), this.nextBarAt);
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
    homeMotif(voice, this.currentBar).forEach((note) =>
      lead(rig, { ...note, at: at + note.offsetS, lengthS: BEAT_S / 2 }),
    );
  }

  private playBar(rig: Rig, index: number, bar: Bar, at: number): void {
    const groove = grooveFor(index, bar, this.uneaseLevel);
    pad(rig, bar, groove, at);
    groove.forEach((hit) => playHit(rig, hit, at + hit.offsetS));
    melodyFor(index).forEach((note) =>
      lead(rig, {
        at: at + note.offsetS,
        midi: note.midi,
        lengthS: note.lengthS,
        level: MELODY_LEVEL,
        pan: 0,
      }),
    );
    this.currentBar = bar;
    if (bar.hasSweep) sweep(rig, at);
  }
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
