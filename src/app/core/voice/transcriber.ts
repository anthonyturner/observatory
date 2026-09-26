import { Injectable, inject } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { CLIP_DECODER, isQuiet, isWordless } from './clip-audio';
import { ModelLoader } from './model-loader';
import { ModelLoaders } from './model-loaders';
import { LISTEN_SPEC } from './model-specs';
import { VoiceError } from './voice-error';
import { VoiceNarration } from './voice-narration';
import { VoiceWorkerClient } from './voice-worker-client';
import { LIMIT_MS, within } from './within';

const WAITING = 'Waiting for the speech model';

/** Turns a recording into text in this browser, with Whisper. No audio
 *  leaves it, and the browser's own speech recognition is never used:
 *  Chrome sends that audio to Google. */
@Injectable({ providedIn: 'root' })
export class Transcriber {
  private readonly client = inject(VoiceWorkerClient);
  private readonly decode = inject(CLIP_DECODER);
  private readonly narration = inject(VoiceNarration);
  private readonly failed = new Subject<VoiceError>();

  /** The speech model, which is always wanted once asked for. */
  readonly model: ModelLoader = inject(ModelLoaders).create(LISTEN_SPEC, {
    isWanted: () => true,
    failed: (error) => this.failed.next(error),
  });
  /** Loads of the speech model that failed, on the card and the processor. */
  readonly failures: Observable<VoiceError> = this.failed.asObservable();

  /** The words in `clip`, or null when it holds none. */
  async transcribe(clip: Blob): Promise<string | null> {
    this.narration.say(this.model.isLoaded() ? this.transcribing() : WAITING);
    const audio = await this.decode(clip).catch(() => null);
    if (!audio || isQuiet(audio)) return null;
    await within(this.model.whenLoaded(), LIMIT_MS.model, 'model');
    this.narration.say(this.transcribing());
    const text = await this.client.transcribe(audio);
    return isWordless(text) ? null : text;
  }

  private transcribing(): string {
    return `Transcribing on ${this.model.currentPath().on}`;
  }
}
