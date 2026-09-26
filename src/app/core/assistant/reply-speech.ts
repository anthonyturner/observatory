import { ErrorHandler, Injectable, computed, inject, signal } from '@angular/core';
import { REPLY_VOICE, ReplyTier } from '../voice/reply-voice';

interface SpokenReply {
  readonly entryId: number;
  readonly heard: Promise<void>;
}

/** Which reply the voice is reading, so a jump can wait for its line and
 *  Stay here or Stop speaking cut off only that one. */
@Injectable({ providedIn: 'root' })
export class ReplySpeech {
  private readonly voice = inject(REPLY_VOICE);
  private readonly errors = inject(ErrorHandler);
  private readonly latest = signal<SpokenReply | null>(null);

  /** The reply being read aloud now, or null. */
  readonly entryId = computed(() =>
    this.voice.speaking() ? (this.latest()?.entryId ?? null) : null,
  );

  speak(text: string, entryId: number, tier: ReplyTier): void {
    const heard = this.voice.speak(text, tier).catch((error: unknown) => {
      this.errors.handleError(error);
    });
    const reply = { entryId, heard };
    this.latest.set(reply);
    void heard.then(() => {
      if (this.latest() === reply) this.latest.set(null);
    });
  }

  /** Settles once the reply's line has been heard, or at once when it is not
   *  the one speaking. */
  heard(entryId: number): Promise<void> {
    const latest = this.latest();
    return latest?.entryId === entryId ? latest.heard : Promise.resolve();
  }

  isSpeaking(entryId: number): boolean {
    return this.latest()?.entryId === entryId;
  }

  /** Cuts off whatever is speaking; true when something was. */
  stop(): boolean {
    return this.voice.stop();
  }
}
