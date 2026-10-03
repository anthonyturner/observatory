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
  /** Whether the line being made may ask anything; one line is made at a time. */
  private mayAsk = true;

  async warmUp(request: WarmUpRequest): Promise<WarmUp> {
    this.mayAsk = request.mayAsk;
    await this.catalog.whenRead;
    return this.current().warmUp(request);
  }

  parts(text: string): string[] {
    return this.current().parts(text);
  }

  async synthesize(part: string): Promise<SpokenClip> {
    const engine = this.current();
    try {
      return await engine.synthesize(part);
    } catch (error: unknown) {
      // A line that may not ask changes nothing either: ElevenLabs stays
      // chosen, and the next reply falls back and says so.
      if (engine !== this.engines.elevenlabs || !this.mayAsk) throw error;
      return this.speakInKokoro(part, error);
    }
  }

  release(): void {
    this.current().release();
  }

  private current(): SpeechEngine {
    return this.engines[this.active.speaker().engine];
  }

  /** ElevenLabs failed mid-reply: Kokoro takes over from this piece, cut to
   *  its own sentences and played as one. A Kokoro that must first ask to
   *  download leaves Speak off till it may. */
  private async speakInKokoro(part: string, error: unknown): Promise<SpokenClip> {
    this.engines.elevenlabs.release();
    this.active.fallBack(failedWith(error));
    const kokoro = this.engines.kokoro;
    const onAgreed = (): void => this.preference.turnOn();
    const warmUp = await kokoro.warmUp({ takesFocus: false, mayAsk: true, onAgreed });
    if (warmUp === 'asked') {
      this.preference.turnOffForVisit();
      throw error;
    }
    const clips: SpokenClip[] = [];
    for (const sentence of kokoro.parts(part)) clips.push(await kokoro.synthesize(sentence));
    return joinedClips(clips);
  }
}

/** Clips made one after another, as one; they share Kokoro's rate. */
export function joinedClips(clips: readonly SpokenClip[]): SpokenClip {
  const audio = new Float32Array(clips.reduce((length, clip) => length + clip.audio.length, 0));
  let at = 0;
  for (const clip of clips) {
    audio.set(clip.audio, at);
    at += clip.audio.length;
  }
  return { audio, rate: clips[0]?.rate ?? 0 };
}
