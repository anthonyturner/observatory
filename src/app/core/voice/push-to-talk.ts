import { Injectable, InjectionToken, Signal, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { REPLY_VOICE } from './reply-voice';
import { DownloadConsent } from './download-consent';
import { CANNOT_RECORD, NEEDS_SECURE_ADDRESS, micTroubleWords } from './mic-trouble';
import { MICROPHONE, MicStream } from './microphone';
import { SpeakSwitch } from './speak-switch';
import { TalkSession, PressKind, TAP_MS } from './talk-session';
import { TalkState } from './talk-state';
import { Transcriber } from './transcriber';
import { TranscriptSender } from './transcript-sender';
import { VoiceError, kindOf } from './voice-error';
import { VoiceLevel } from './voice-level';
import { VoiceNarration } from './voice-narration';
import { StatusAction, VoiceStatus } from './voice-status';

/** Milliseconds on a clock that only goes forward; a test sets it. */
export const TALK_CLOCK = new InjectionToken<() => number>('TalkClock', {
  providedIn: 'root',
  factory: () => () => performance.now(),
});

/** A recording stops by itself after this long. */
const MAX_TALK_MS = 30000;

const LISTENING_TAP = 'Listening. Press again to stop';
const LISTENING_HOLD = 'Listening. Let go to send';
const ALLOW_PROMPT = 'Allow the microphone in the browser’s prompt.';
const ALLOWED = 'Microphone allowed. Press Tap to talk, or hold M, and speak.';
const THREW_AWAY = 'Threw the recording away.';
const STILL_LOADING =
  'The speech model is still loading, so that was not kept. Try again once it says it is ready.';
const NOT_TURNED = 'Couldn’t turn that into text. Try again.';
const DOWNLOAD_FAILED = 'Couldn’t download the speech model. Check the connection.';

/** How a recording ended: let go or pressed again, or cut off by the
 *  microphone, whose words are still used. */
interface Ending {
  readonly heardNothing: string;
  readonly afterSending: string | null;
}

const ENDED: Ending = {
  heardNothing: 'Heard nothing. Try again, closer to the mic.',
  afterSending: null,
};
const CUT_OFF: Ending = {
  heardNothing:
    'The microphone stopped. Check it is connected and allowed, then press Tap to talk again.',
  afterSending: 'The microphone stopped, so Home used what it heard until then.',
};

/** Push-to-talk: hold the mic or M and let go to send, or tap to start and
 *  press again to stop. The transcript is sent like a typed request. */
@Injectable({ providedIn: 'root' })
export class PushToTalk {
  private readonly mic = inject(MICROPHONE);
  private readonly transcriber = inject(Transcriber);
  private readonly consent = inject(DownloadConsent);
  private readonly status = inject(VoiceStatus);
  private readonly narration = inject(VoiceNarration);
  private readonly replyVoice = inject(REPLY_VOICE);
  private readonly speakSwitch = inject(SpeakSwitch);
  private readonly sender = inject(TranscriptSender);
  private readonly talkState = inject(TalkState);
  private readonly level = inject(VoiceLevel);
  private readonly now = inject(TALK_CLOCK);
  private readonly recordingNow = signal(false);
  private readonly workingNow = signal(false);
  private readonly blockedNow = signal(false);
  private talk: TalkSession | null = null;
  /** Why the speech model cannot run, while it cannot; said again at each press. */
  private modelTrouble: string | null = null;

  readonly isRecording: Signal<boolean> = this.recordingNow.asReadonly();
  /** Turning a recording into text. */
  readonly isWorking: Signal<boolean> = this.workingNow.asReadonly();
  /** Voice cannot run until the viewer does something; the status line says what. */
  readonly isBlocked: Signal<boolean> = this.blockedNow.asReadonly();

  constructor() {
    this.transcriber.failures
      .pipe(takeUntilDestroyed())
      .subscribe((error) => this.modelFailed(error));
  }

  /** A press of the mic or M, or the mic's keyboard toggle. */
  async press(how: PressKind): Promise<void> {
    const talk = this.talk;
    if (talk?.isRecording && (talk.mode === 'tap' || how === 'toggle')) {
      return this.finish(talk, ENDED);
    }
    this.replyVoice.stop();
    this.speakSwitch.wake();
    if (talk) return;
    if (this.modelTrouble) return this.block(this.modelTrouble, [this.retryAction()]);
    if (!this.mic.canRecord()) {
      return this.block(this.mic.isSecure() ? CANNOT_RECORD : NEEDS_SECURE_ADDRESS);
    }
    const next = new TalkSession(how, this.now());
    this.setTalk(next);
    if (await this.isModelReady(next)) await this.start(next);
  }

  /** Letting go of the mic or M. A short press was a tap, and keeps listening. */
  release(): void {
    const talk = this.talk;
    if (!talk || talk.isReleased) return;
    talk.release(this.now());
    if (!talk.isRecording) return;
    if (talk.heldForMs >= TAP_MS) {
      void this.finish(talk, ENDED);
      return;
    }
    talk.mode = 'tap';
    this.narration.say(LISTENING_TAP);
  }

  /** Esc: throws the recording away. False when there was none to throw. */
  discard(): boolean {
    const talk = this.talk;
    if (!talk || talk.isTranscribing()) return false;
    this.abandon(talk);
    this.narration.say(THREW_AWAY);
    return true;
  }

  /** Loads the model if the browser has it; asks first if it must download. */
  private async isModelReady(talk: TalkSession): Promise<boolean> {
    const model = this.transcriber.model;
    if (model.isLoading()) return true;
    const isCached = await model.isCached();
    if (this.talk !== talk) return false;
    if (!isCached) {
      this.setTalk(null);
      await this.consent.ask(model, { takesFocus: true });
      return false;
    }
    this.loadModel();
    return true;
  }

  private async start(talk: TalkSession): Promise<void> {
    const stream = await this.openMic(talk);
    if (!stream) return;
    if (this.talk !== talk || this.modelTrouble) {
      stream.close();
      this.endIfCurrent(talk);
    } else if (talk.wasHeldThroughPrompt()) {
      stream.close();
      this.setTalk(null);
      this.status.show(ALLOWED);
      this.narration.echo(ALLOWED);
    } else {
      this.record(talk, stream);
    }
  }

  private async openMic(talk: TalkSession): Promise<MicStream | null> {
    const prompt = setTimeout(() => {
      if (this.talk === talk) this.status.show(ALLOW_PROMPT);
    }, TAP_MS);
    try {
      const stream = await this.mic.open();
      if (!this.modelTrouble) this.blockedNow.set(false);
      return stream;
    } catch (error: unknown) {
      this.endIfCurrent(talk);
      this.block(micTroubleWords(error));
      return null;
    } finally {
      clearTimeout(prompt);
    }
  }

  private record(talk: TalkSession, stream: MicStream): void {
    if (talk.isReleased) talk.mode = 'tap';
    const recording = stream.record(() => {
      if (this.talk === talk && talk.isRecording) void this.finish(talk, CUT_OFF);
    });
    talk.recording = recording;
    talk.isRecording = true;
    talk.limit = setTimeout(() => void this.finish(talk, ENDED), MAX_TALK_MS);
    talk.stopMeter = this.level.follow(() => recording.level());
    this.recordingNow.set(true);
    if (this.status.isTroubleShown() || this.status.line()?.words === ALLOW_PROMPT) {
      this.status.clear();
    }
    this.narration.say(talk.mode === 'tap' ? LISTENING_TAP : LISTENING_HOLD);
  }

  private async finish(talk: TalkSession, ending: Ending): Promise<void> {
    const recording = talk.recording;
    if (this.talk !== talk || !talk.isRecording || !recording) return;
    this.endRecording(talk);
    this.workingNow.set(true);
    try {
      const text = await this.transcriber.transcribe(await recording.finish());
      if (text === null) {
        this.narration.say(ending.heardNothing);
        return;
      }
      this.narration.clear();
      await this.sender.send(text);
      if (ending.afterSending) this.narration.sayBriefly(ending.afterSending);
    } catch (error: unknown) {
      this.transcriptionFailed(error);
    } finally {
      this.workingNow.set(false);
      this.endIfCurrent(talk);
    }
  }

  /** A model that failed to load has said so already. */
  private transcriptionFailed(error: unknown): void {
    if (this.modelTrouble) return;
    const words = kindOf(error) === 'model' ? STILL_LOADING : NOT_TURNED;
    this.status.showTrouble(words);
    this.narration.echo(words);
  }

  /** Nothing said now could be turned into text, so it is dropped unsaid. */
  private modelFailed(error: VoiceError): void {
    this.modelTrouble = error.kind === 'download' ? DOWNLOAD_FAILED : this.cannotRunWords();
    if (this.talk && !this.talk.isTranscribing()) this.abandon(this.talk);
    this.block(this.modelTrouble, [this.retryAction()]);
  }

  private cannotRunWords(): string {
    const model = this.transcriber.model;
    const where = model.hasFallenBack()
      ? 'the graphics card and on the processor'
      : model.currentPath().on.replace(', slower', '');
    return `Voice input can’t run in this browser: the speech model failed on ${where}. Typing still works.`;
  }

  private retryAction(): StatusAction {
    return {
      label: 'Try again',
      kind: 'plain',
      focusAfter: 'mic',
      run: () => {
        this.modelTrouble = null;
        this.blockedNow.set(false);
        this.transcriber.model.forget();
        this.loadModel();
      },
    };
  }

  private block(words: string, actions: readonly StatusAction[] = []): void {
    this.blockedNow.set(true);
    this.status.showTrouble(words, actions);
    this.narration.echo(words);
  }

  /** A failure reaches `modelFailed` through the transcriber. */
  private loadModel(): void {
    this.transcriber.model.load().catch(() => undefined);
  }

  private abandon(talk: TalkSession): void {
    this.setTalk(null);
    if (!talk.isRecording) return;
    this.endRecording(talk);
    talk.recording?.discard();
  }

  private endRecording(talk: TalkSession): void {
    talk.isRecording = false;
    clearTimeout(talk.limit);
    talk.stopMeter();
    this.recordingNow.set(false);
  }

  private endIfCurrent(talk: TalkSession): void {
    if (this.talk === talk) this.setTalk(null);
  }

  private setTalk(talk: TalkSession | null): void {
    this.talk = talk;
    if (talk) this.talkState.begin();
    else this.talkState.end();
  }
}
