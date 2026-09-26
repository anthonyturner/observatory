import { InjectionToken, inject } from '@angular/core';
import { KokoroEngine } from './kokoro-engine';
import { SpokenClip } from './voice-protocol';

export interface WarmUpRequest {
  /** Whether a download question takes the focus; not when it comes unasked. */
  readonly takesFocus: boolean;
  /** Runs if the viewer agrees to a download the engine asked about. */
  readonly onAgreed: () => void;
}

/** `ready` to speak, or `asked` the viewer first. */
export type WarmUp = 'ready' | 'asked';

/** Makes the sound of a reply, one sentence at a time. SpokenReplies does
 *  the rest (the queue, cut-off, the level), so a new voice is one more
 *  engine. */
export interface SpeechEngine {
  /** Gets ready to speak. A first download is asked about rather than
   *  started, and answers `asked`. */
  warmUp(request: WarmUpRequest): Promise<WarmUp>;
  /** One sentence as sound. Rejects with a VoiceError; `model` while the
   *  engine is still getting ready. A failure that turned Speak off has been
   *  reported by the engine already. */
  synthesize(sentence: string): Promise<SpokenClip>;
  /** Speak is off: let go of what it holds. */
  release(): void;
}

/** Kokoro, in this browser, until there is a choice of voice. */
export const SPEECH_ENGINE = new InjectionToken<SpeechEngine>('SpeechEngine', {
  providedIn: 'root',
  factory: () => inject(KokoroEngine),
});
