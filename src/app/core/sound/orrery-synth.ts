import { AmbientPlayer } from './ambient-synth';
import { bass, barPad, noiseBurst, pluck, thump } from './instruments';
import {
  LOOP_STEPS,
  STEPS_PER_BAR,
  STEP_S,
  ScoreEvent,
  SystemSound,
  motifFor,
  stepEvents,
} from './orrery-score';
import { Rig, RoomShape, buildRig, fadeTo } from './sound-rig';

/** What the orrery score listens to, read afresh at every step. */
export interface OrreryListening {
  system(): SystemSound;
  /** The world picked on the page, whose motif plays when it changes. */
  picked(): string | null;
  isHidden(): boolean;
}

/** A shorter room than Home's, with a dotted-eighth echo: the delay that
 *  makes a plain arpeggio sound like it is travelling somewhere. */
/** pr-starmap's orrery started at a volume of 0.6. */
export const DEFAULT_VOLUME = 0.6;
/** Loudness is heard on a curve, so the slider is squared, as pr-starmap did. */
export const orreryGain = (volume: number): number => volume * volume * 2.2;

const ORRERY_ROOM: RoomShape = {
  reverbS: 3.2,
  reverbDecay: 2.2,
  wet: 0.42,
  echoS: STEP_S * 3,
  echoFeedback: 0.34,
  echoFloorHz: 500,
  echoLevel: 0.5,
  outLevel: orreryGain(DEFAULT_VOLUME),
};
/** Notes are written this far ahead on the audio clock, so a busy frame or a
 *  slow timer never makes the rhythm stumble. */
const LOOKAHEAD_S = 0.12;
/** A background tab's timers fire about once a second, so there the score is
 *  written further ahead to keep playing without a gap. */
const HIDDEN_LOOKAHEAD_S = 1.6;
const TICK_MS = 25;
const FADE_IN_S = 2.4;
const FADE_OUT_S = 0.75;
const SUSPEND_AFTER_MS = 1200;
const MOTIF_LEAD_S = 0.02;

/** The glide when the volume slider moves, so dragging it never clicks. */
const VOLUME_GLIDE_S = 0.04;

/** pr-starmap's orrery score on the Web Audio API. */
export class OrrerySynth implements AmbientPlayer {
  private rig: Rig | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private suspendTimer: ReturnType<typeof setTimeout> | null = null;
  private nextAt = 0;
  private step = 0;
  private lastPicked: string | null = null;
  private volume = DEFAULT_VOLUME;

  constructor(private readonly listening: OrreryListening) {}

  async start(): Promise<void> {
    if (!this.rig) {
      this.rig = buildRig(ORRERY_ROOM);
      this.rig.out.gain.value = orreryGain(this.volume);
    }
    const rig = this.rig;
    if (this.suspendTimer) clearTimeout(this.suspendTimer);
    if (rig.context.state === 'suspended') await rig.context.resume();
    fadeTo(rig, 1, FADE_IN_S);
    if (this.timer) return;
    this.nextAt = rig.context.currentTime + 0.06;
    this.step = 0;
    this.lastPicked = this.listening.picked();
    this.timer = setInterval(() => this.tick(), TICK_MS);
  }

  setVolume(volume: number): void {
    this.volume = Math.min(1, Math.max(0, volume));
    const rig = this.rig;
    if (!rig) return;
    rig.out.gain.setTargetAtTime(orreryGain(this.volume), rig.context.currentTime, VOLUME_GLIDE_S);
  }

  stop(): void {
    if (!this.rig) return;
    fadeTo(this.rig, 0, FADE_OUT_S);
    this.suspendTimer = setTimeout(() => this.release(), SUSPEND_AFTER_MS);
  }

  dispose(): void {
    if (this.suspendTimer) clearTimeout(this.suspendTimer);
    this.release();
    // Closing only frees the audio device sooner; if it fails, it idles silent.
    this.rig?.context.close().catch(() => undefined);
    this.rig = null;
  }

  private release(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    // Suspending only frees the audio device early; if it fails, it idles silent.
    this.rig?.context.suspend().catch(() => undefined);
  }

  private tick(): void {
    const rig = this.rig;
    if (!rig) return;
    const now = rig.context.currentTime;
    // A timer held back past the beat would otherwise play every missed step
    // at once; drop them and pick the rhythm up from now.
    if (this.nextAt < now) this.nextAt = now + 0.06;
    const ahead = this.listening.isHidden() ? HIDDEN_LOOKAHEAD_S : LOOKAHEAD_S;
    const system = this.listening.system();
    this.playMotifIfPicked(rig, system);
    while (this.nextAt < now + ahead) {
      this.play(rig, stepEvents(this.step, system), this.nextAt);
      this.nextAt += STEP_S;
      this.step = (this.step + 1) % LOOP_STEPS;
    }
  }

  private playMotifIfPicked(rig: Rig, system: SystemSound): void {
    const picked = this.listening.picked();
    if (picked === this.lastPicked) return;
    this.lastPicked = picked;
    const voice = system.voices.find((one) => one.key === picked);
    if (!voice) return;
    const start = rig.context.currentTime + MOTIF_LEAD_S;
    motifFor(voice, this.step).forEach((event, i) => this.play(rig, [event], start + i * STEP_S));
  }

  private play(rig: Rig, events: readonly ScoreEvent[], at: number): void {
    for (const event of events) playEvent(rig, event, at);
  }
}

function playEvent(rig: Rig, event: ScoreEvent, at: number): void {
  switch (event.kind) {
    case 'pad':
      barPad(rig, at, event.notes, STEP_S * STEPS_PER_BAR);
      return;
    case 'sweep':
      noiseBurst(rig, {
        at: at + STEP_S * 8,
        type: 'bandpass',
        freq: 300,
        to: 4200,
        q: 6,
        decay: STEP_S * 7,
        level: event.level,
        pan: event.pan,
      });
      return;
    case 'thump':
      thump(rig, at, event.level);
      return;
    case 'hat':
      noiseBurst(rig, { at, level: 0.018, decay: 0.035 });
      return;
    case 'bass':
      bass(rig, at, event.midi, STEP_S);
      return;
    case 'pluck':
      pluck(rig, {
        at,
        midi: event.midi,
        severity: event.severity,
        pan: event.pan,
        level: event.level,
      });
      return;
  }
}
