import { Injectable, InjectionToken, inject } from '@angular/core';
import { ActiveVoice } from './active-voice';
import { ElevenLabsEngine } from './eleven-labs-engine';
import { KokoroEngine } from './kokoro-engine';
import { SpeakPreference } from './speak-preference';
import { SpeechEngine, WarmUp, WarmUpRequest } from './speech-engine';
import { VoiceCatalog } from './voice-catalog';
import { VoiceEngineId } from './voice-choice';
import { messageOf } from './voice-error';
import { SpokenClip } from './voice-protocol';

/** Every engine a reply can be read by, by the name the viewer picks it by. */
export const SPEECH_ENGINES = new InjectionToken<Readonly<Record<VoiceEngineId, SpeechEngine>>>(
  'SpeechEngines',
  {
    providedIn: 'root',
    factory: () => ({ kokoro: inject(KokoroEngine), elevenlabs: inject(ElevenLabsEngine) }),
  },
);

const failedWith = (error: unknown): string => `ElevenLabs failed: ${messageOf(error)}`;

/** The engine the viewer picked, or Kokoro for the rest of the visit when
 *  ElevenLabs is off, not available here, or fails. FallbackNotice says so. */
@Injectable({ providedIn: 'root' })
export class ChosenEngine implements SpeechEngine {
  private readonly engines = inject(SPEECH_ENGINES);
  private readonly active = inject(ActiveVoice);
  private readonly catalog = inject(VoiceCatalog);
  private readonly preference = inject(SpeakPreference);

  async warmUp(request: WarmUpRequest): Promise<WarmUp> {
    await this.catalog.whenRead;
    return this.current().warmUp(request);
  }

  async synthesize(sentence: string): Promise<SpokenClip> {
    const engine = this.current();
    try {
      return await engine.synthesize(sentence);
    } catch (error: unknown) {
      if (engine !== this.engines.elevenlabs) throw error;
      return this.speakInKokoro(sentence, error);
    }
  }

  release(): void {
    this.current().release();
  }

  private current(): SpeechEngine {
    return this.engines[this.active.speaker().engine];
  }

  /** ElevenLabs failed mid-reply: Kokoro takes over from this sentence. A
   *  Kokoro that must first ask to download leaves Speak off till it may. */
  private async speakInKokoro(sentence: string, error: unknown): Promise<SpokenClip> {
    this.engines.elevenlabs.release();
    this.active.fallBack(failedWith(error));
    const kokoro = this.engines.kokoro;
    const onAgreed = (): void => this.preference.turnOn();
    const warmUp = await kokoro.warmUp({ takesFocus: false, onAgreed });
    if (warmUp === 'asked') {
      this.preference.turnOffForVisit();
      throw error;
    }
    return kokoro.synthesize(sentence);
  }
}
