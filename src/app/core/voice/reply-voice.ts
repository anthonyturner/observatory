import { InjectionToken, Signal, signal } from '@angular/core';

/** How much effort a reply took: an app action, a quick answer, or a task. */
export type ReplyTier = 1 | 2 | 3;

/** Reads the assistant's replies aloud. The Ask feed depends on this alone,
 *  whichever voice (Kokoro in the browser, ElevenLabs on the server) speaks. */
export interface ReplyVoice {
  /** Reads `text` aloud, cutting off whatever was speaking. Settles when it
   *  has finished, been cut off, or could not be spoken. */
  speak(text: string, tier: ReplyTier): Promise<void>;
  /** Stops speaking. True when something was cut off. */
  stop(): boolean;
  /** True while a reply is being read aloud. */
  readonly speaking: Signal<boolean>;
}

/** Until a voice is provided, replies are only read on screen. */
const SILENT: ReplyVoice = {
  speak: async () => undefined,
  stop: () => false,
  speaking: signal(false).asReadonly(),
};

export const REPLY_VOICE = new InjectionToken<ReplyVoice>('ReplyVoice', {
  providedIn: 'root',
  factory: () => SILENT,
});
