import { ErrorHandler, Injectable, inject } from '@angular/core';
import { sentences } from './sentences';
import { DownloadConsent } from './download-consent';
import { ModelLoaders } from './model-loaders';
import { SPEAK_SPEC } from './model-specs';
import { SpeakPreference } from './speak-preference';
import { switchSpeakOn } from './speak-on';
import { SpeakerOutput } from './speaker-output';
import { SpeechEngine, WarmUp, WarmUpRequest } from './speech-engine';
import { VoiceError } from './voice-error';
import { VoiceNarration } from './voice-narration';
import { SpokenClip } from './voice-protocol';
import { VoiceStatus } from './voice-status';
import { VoiceWorkerClient } from './voice-worker-client';
import { LIMIT_MS, within } from './within';

const DOWNLOAD_FAILED = 'Couldn’t download the voice model. Check the connection.';
const CANNOT_LOAD =
  'Spoken replies are off: the voice model couldn’t load here. Replies still show as text.';

/** Kokoro, in the voice worker beside Whisper. No text leaves the browser,
 *  and the browser's own speech synthesis is never used: Chrome's default
 *  voices are Google's servers. */
@Injectable({ providedIn: 'root' })
export class KokoroEngine implements SpeechEngine {
  private readonly client = inject(VoiceWorkerClient);
  private readonly consent = inject(DownloadConsent);
  private readonly preference = inject(SpeakPreference);
  private readonly status = inject(VoiceStatus);
  private readonly narration = inject(VoiceNarration);
  private readonly speaker = inject(SpeakerOutput);
  private readonly errors = inject(ErrorHandler);
  private readonly model = inject(ModelLoaders).create(SPEAK_SPEC, {
    isWanted: () => this.preference.isOn(),
    failed: (error) => this.failed(error),
  });

  /** Loads the model if the browser has it already; asks before a download,
   *  where the request allows it. */
  async warmUp(request: WarmUpRequest): Promise<WarmUp> {
    if (!this.model.isLoading() && !(await this.model.isCached())) {
      if (!request.mayAsk) return 'unready';
      await this.consent.ask(this.model, request);
      return 'asked';
    }
    this.load();
    return 'ready';
  }

  /** Kokoro reads at most about 500 sounds at a time: one sentence each. */
  parts(text: string): string[] {
    return sentences(text);
  }

  async synthesize(sentence: string): Promise<SpokenClip> {
    await within(this.model.whenLoaded(), LIMIT_MS.model, 'model');
    return this.client.synthesize(sentence);
  }

  release(): void {
    this.model.unload();
  }

  /** A failure reaches `failed` through the loader. */
  private load(): void {
    this.model.load().catch(() => undefined);
  }

  private failed(error: VoiceError): void {
    this.preference.turnOffForVisit();
    const words = error.kind === 'download' ? DOWNLOAD_FAILED : CANNOT_LOAD;
    this.status.showTrouble(words, [
      { label: 'Try again', kind: 'plain', focusAfter: 'speak', run: () => this.retry() },
    ]);
    this.narration.echo(words);
  }

  /** Afresh on the card, as a press of Speak. */
  private retry(): void {
    this.model.forget();
    const { preference, speaker } = this;
    switchSpeakOn({ engine: this, preference, speaker }).catch((error: unknown) =>
      this.errors.handleError(error),
    );
  }
}
