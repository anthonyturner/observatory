import { DestroyRef, Injectable, Signal, inject, signal } from '@angular/core';

/** How long a passing line stays before it clears. */
const PASSING_MS = 5000;

export interface Narration {
  readonly words: string;
  /** False for words already on screen in the status line, said to a
   *  screen reader only. */
  readonly isVisible: boolean;
}

/** What voice is doing right now, in a live region under the controls:
 *  "Listening", "Transcribing", "Heard nothing". */
@Injectable({ providedIn: 'root' })
export class VoiceNarration {
  private readonly current = signal<Narration | null>(null);
  private timer: ReturnType<typeof setTimeout> | undefined;

  readonly said: Signal<Narration | null> = this.current.asReadonly();

  constructor() {
    inject(DestroyRef).onDestroy(() => clearTimeout(this.timer));
  }

  /** Shown until something else is said. */
  say(words: string): void {
    this.set({ words, isVisible: true });
  }

  /** Shown, then cleared after a few seconds. */
  sayBriefly(words: string): void {
    this.setPassing({ words, isVisible: true });
  }

  /** Said to a screen reader when the words already show elsewhere. */
  echo(words: string): void {
    this.setPassing({ words, isVisible: false });
  }

  clear(): void {
    this.set(null);
  }

  private set(narration: Narration | null): void {
    clearTimeout(this.timer);
    this.current.set(narration);
  }

  private setPassing(narration: Narration): void {
    this.set(narration);
    this.timer = setTimeout(() => this.current.set(null), PASSING_MS);
  }
}
