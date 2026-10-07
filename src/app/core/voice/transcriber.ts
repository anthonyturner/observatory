import { Injectable, inject } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { CLIP_DECODER, isQuiet, isWordless } from './clip-audio';
import { COMMAND_VOCABULARY, whisperPromptOf } from './command-vocabulary';
import { ElevenLabsHearing, HearingFailed } from './eleven-labs-hearing';
import { ModelLoader } from './model-loader';
import { ModelLoaders } from './model-loaders';
import { LISTEN_SPEC } from './model-specs';
import { VoiceError } from './voice-error';
import { VoiceNarration } from './voice-narration';
import { VoiceWorkerClient } from './voice-worker-client';
import { LIMIT_MS, within } from './within';

const WAITING = 'Waiting for the speech model';
const HEARING = 'Transcribing with ElevenLabs';

/** Turns a recording into text: with ElevenLabs Scribe while ElevenLabs is
 *  on (far better than a model small enough to download), else with Whisper
 *  in this browser, where no audio leaves it. The browser's own speech
 *  recognition is never used: Chrome sends that audio to Google. */
@Injectable({ providedIn: 'root' })
export class Transcriber {
  private readonly client = inject(VoiceWorkerClient);
  private readonly decode = inject(CLIP_DECODER);
  private readonly narration = inject(VoiceNarration);
  private readonly failed = new Subject<VoiceError>();
  private readonly hearing = inject(ElevenLabsHearing);
  private readonly vocabulary = inject(COMMAND_VOCABULARY);

  /** The speech model, which is always wanted once asked for. */
  readonly model: ModelLoader = inject(ModelLoaders).create(LISTEN_SPEC, {
    isWanted: () => true,
    failed: (error) => this.failed.next(error),
  });
  /** Loads of the speech model that failed, on the card and the processor. */
  readonly failures: Observable<VoiceError> = this.failed.asObservable();

  /** The words in `clip`, or null when it holds none. Both ways of hearing
   *  are told to expect the words Jev's commands use. */
  async transcribe(clip: Blob): Promise<string | null> {
    const vocabulary = this.vocabulary();
    if (this.hearing.isAvailable()) {
      const heard = await this.hearByElevenLabs(clip, vocabulary);
      if (heard !== undefined) return heard;
    }
    this.narration.say(this.model.isLoaded() ? this.transcribing() : WAITING);
    const audio = await this.decode(clip).catch(() => null);
    if (!audio || isQuiet(audio)) return null;
    await within(this.model.whenLoaded(), LIMIT_MS.model, 'model');
    this.narration.say(this.transcribing());
    const text = await this.client.transcribe(audio, whisperPromptOf(vocabulary));
    return isWordless(text) ? null : text;
  }

  /** ElevenLabs' words, or undefined when it failed and Whisper, already
   *  here, should take this recording instead. A failure with no Whisper
   *  ready is passed on, so the page can say why and offer it. */
  private async hearByElevenLabs(
    clip: Blob,
    vocabulary: readonly string[],
  ): Promise<string | null | undefined> {
    this.narration.say(HEARING);
    try {
      const text = (await this.hearing.hear(clip, vocabulary)).trim();
      return isWordless(text) ? null : text;
    } catch (error: unknown) {
      if (error instanceof HearingFailed && this.model.isLoaded()) return undefined;
      throw error;
    }
  }

  private transcribing(): string {
    return `Transcribing on ${this.model.currentPath().on}`;
  }
}
