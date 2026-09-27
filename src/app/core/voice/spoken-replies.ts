import { DOCUMENT, DestroyRef, Injectable, Signal, inject, signal } from '@angular/core';
import { ReplyTier, ReplyVoice } from './reply-voice';
import { sentences } from './sentences';
import { SpeakPreference } from './speak-preference';
import { SpeakerOutput } from './speaker-output';
import { SPEECH_ENGINE } from './speech-engine';
import { SpeechJob } from './speech-job';
import { TalkState } from './talk-state';
import { VoiceFailureKind, kindOf } from './voice-error';
import { VoiceLevel } from './voice-level';
import { VoiceNarration } from './voice-narration';
import { VoiceStatus } from './voice-status';

/** Why a reply went unheard, in words. Its text always shows. */
const STILL_LOADING = 'The voice model is still loading, so that reply was not spoken.';
const NO_SOUND =
  'This browser did not let Home play sound, so that reply was not spoken. Its text is above.';
const NOT_SPOKEN = 'Couldn’t speak that reply. Its text is above.';
/** Failures that pass, and so are not shown as trouble. */
const PASSING: Partial<Record<VoiceFailureKind, string>> = {
  model: STILL_LOADING,
  audio: NO_SOUND,
};

/** One reply being read aloud. */
class ReplyTurn {
  job: SpeechJob | null = null;
  stopMeter: () => void = () => undefined;
  isEnded = false;
  readonly done: Promise<void>;
  finish: () => void = () => undefined;

  constructor(readonly tier: ReplyTier) {
    this.done = new Promise((resolve) => (this.finish = resolve));
  }
}

/** Reads replies aloud, piece by piece as the engine cuts them, each made
 *  while the one before it plays, so a long answer starts as soon as its
 *  first piece is ready.
 *  Tap to talk, Esc, a new reply, Speak turned off and leaving the page all
 *  cut it off at once. The engine makes the sound; this does the rest. */
@Injectable({ providedIn: 'root' })
export class SpokenReplies implements ReplyVoice {
  private readonly engine = inject(SPEECH_ENGINE);
  private readonly preference = inject(SpeakPreference);
  private readonly talk = inject(TalkState);
  private readonly speaker = inject(SpeakerOutput);
  private readonly level = inject(VoiceLevel);
  private readonly status = inject(VoiceStatus);
  private readonly narration = inject(VoiceNarration);
  private readonly speakingNow = signal(false);
  private readonly tierNow = signal<ReplyTier | null>(null);
  private turn: ReplyTurn | null = null;

  readonly speaking: Signal<boolean> = this.speakingNow.asReadonly();
  /** The tier of the reply being heard, for the core's lit arc. */
  readonly tier: Signal<ReplyTier | null> = this.tierNow.asReadonly();

  constructor() {
    const window = inject(DOCUMENT).defaultView;
    const leave = (): void => void this.stop();
    window?.addEventListener('pagehide', leave);
    inject(DestroyRef).onDestroy(() => {
      window?.removeEventListener('pagehide', leave);
      this.stop();
    });
  }

  speak(text: string, tier: ReplyTier): Promise<void> {
    this.stop();
    const hasWords = sentences(text).length > 0;
    if (!this.preference.isOn() || this.talk.isTalking() || !hasWords) return Promise.resolve();
    const turn = new ReplyTurn(tier);
    this.turn = turn;
    this.readAloud(turn, text)
      .catch((error: unknown) => {
        if (this.turn === turn) this.report(error);
      })
      .finally(() => this.end(turn));
    return turn.done;
  }

  stop(): boolean {
    const turn = this.turn;
    if (!turn) return false;
    this.end(turn);
    return true;
  }

  private async readAloud(turn: ReplyTurn, text: string): Promise<void> {
    const onAgreed = (): void => this.preference.turnOn();
    const warmUp = await this.engine.warmUp({ takesFocus: false, onAgreed });
    // A download waits for the viewer's say-so, so Speak is off till then.
    if (warmUp === 'asked') this.preference.turnOffForVisit();
    if (warmUp === 'asked' || this.turn !== turn) return;
    const line = await this.speaker.ready();
    if (this.turn !== turn) return;
    const job = new SpeechJob(line, () => this.startedSounding(turn));
    turn.job = job;
    // Cut once warmed up: the picked voice is known by then.
    for (const part of this.engine.parts(text)) {
      const clip = await this.engine.synthesize(part);
      if (this.turn !== turn) return;
      job.play(clip);
    }
    await job.heard();
  }

  private startedSounding(turn: ReplyTurn): void {
    this.speakingNow.set(true);
    this.tierNow.set(turn.tier);
    turn.stopMeter = this.level.follow(() => this.speaker.level());
  }

  /** Lets go of everything the reply held. Safe to repeat. */
  private end(turn: ReplyTurn): void {
    if (turn.isEnded) return;
    turn.isEnded = true;
    turn.job?.stop();
    turn.stopMeter();
    if (this.turn === turn) {
      this.turn = null;
      this.speakingNow.set(false);
      this.tierNow.set(null);
    }
    turn.finish();
  }

  /** Speak turned off by a failure means the engine has said why already. */
  private report(error: unknown): void {
    if (!this.preference.isOn()) return;
    const passing = PASSING[kindOf(error)];
    if (passing) this.status.show(passing);
    else this.status.showTrouble(NOT_SPOKEN);
    this.narration.echo(passing ?? NOT_SPOKEN);
  }
}
