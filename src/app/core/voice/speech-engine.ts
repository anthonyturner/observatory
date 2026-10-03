import { InjectionToken, inject } from '@angular/core';
import { ChosenEngine } from './chosen-engine';
import { SpokenClip } from './voice-protocol';

export interface WarmUpRequest {
  /** Whether a download question takes the focus; not when it comes unasked. */
  readonly takesFocus: boolean;
  /** Whether a first download may be asked about. Not for a line nobody
   *  asked for. */
  readonly mayAsk: boolean;
  /** Runs if the viewer agrees to a download the engine asked about. */
  readonly onAgreed: () => void;
}

/** `ready` to speak, `asked` the viewer first, or `unready`: a download is
 *  needed and the request did not allow asking. */
export type WarmUp = 'ready' | 'asked' | 'unready';

/** Makes the sound of a reply, one piece at a time. SpokenReplies does
 *  the rest (the queue, cut-off, the level), so a new voice is one more
 *  engine. */
export interface SpeechEngine {
  /** Gets ready to speak. A first download is asked about rather than
   *  started, and answers `asked`, or `unready` where it may not ask. */
  warmUp(request: WarmUpRequest): Promise<WarmUp>;
  /** A reply cut into the pieces this engine speaks best, in order: one
   *  sentence each for a model with a short reach, larger pieces for one that
   *  speaks a whole paragraph in one breath. */
  parts(text: string): string[];
  /** One piece as sound. Rejects with a VoiceError; `model` while the
   *  engine is still getting ready. A failure that turned Speak off has been
   *  reported by the engine already. */
  synthesize(part: string): Promise<SpokenClip>;
  /** Speak is off: let go of what it holds. */
  release(): void;
}

/** The voice the viewer picked: Kokoro in this browser, or ElevenLabs. */
export const SPEECH_ENGINE = new InjectionToken<SpeechEngine>('SpeechEngine', {
  providedIn: 'root',
  factory: () => inject(ChosenEngine),
});
