import { Injectable, inject } from '@angular/core';
import { ActiveVoice } from './active-voice';
import { AUDIO_DECODER } from './audio-decoder';
import { ELEVENLABS_SPEECH, ElevenLabsRefusal, SpeechRequest } from './eleven-labs-speech';
import { SpeechEngine, WarmUp } from './speech-engine';
import { VoiceCatalog } from './voice-catalog';
import { VoiceError } from './voice-error';
import { SpokenClip } from './voice-protocol';
import { LIMIT_MS, within } from './within';

/** Why a sentence went unspoken, as clauses: "ElevenLabs failed: …". */
const NO_VOICE = 'there is no voice to speak in';
const TOO_SLOW = 'it took too long to answer';
const UNPLAYABLE = 'it sent sound this browser couldn’t play';

/** ElevenLabs, on the site, which holds the key. Nothing to download, and
 *  every sentence costs the owner money, so the site sends one at a time. */
@Injectable({ providedIn: 'root' })
export class ElevenLabsEngine implements SpeechEngine {
  private readonly speech = inject(ELEVENLABS_SPEECH);
  private readonly decoder = inject(AUDIO_DECODER);
  private readonly catalog = inject(VoiceCatalog);
  private readonly active = inject(ActiveVoice);

  /** Ready once the account's voices are read. */
  async warmUp(): Promise<WarmUp> {
    await this.catalog.whenRead;
    return 'ready';
  }

  /** Rejects with a `run` VoiceError whose message says why, as a clause. */
  async synthesize(sentence: string): Promise<SpokenClip> {
    const voice = this.active.elevenLabsVoice();
    if (!voice) throw new VoiceError(NO_VOICE, 'run');
    const encoded = await this.fetchSound({ text: sentence, voice: voice.id });
    return this.decode(encoded);
  }

  /** Holds nothing between sentences. */
  release(): void {
    return;
  }

  private async fetchSound(request: SpeechRequest): Promise<ArrayBuffer> {
    try {
      return await within(this.speech.speak(request), LIMIT_MS.run, 'run');
    } catch (error: unknown) {
      if (error instanceof ElevenLabsRefusal) throw new VoiceError(error.message, 'run');
      if (error instanceof VoiceError) throw new VoiceError(TOO_SLOW, 'run');
      throw error;
    }
  }

  private async decode(encoded: ArrayBuffer): Promise<SpokenClip> {
    try {
      return await this.decoder.decode(encoded);
    } catch {
      throw new VoiceError(UNPLAYABLE, 'run');
    }
  }
}
