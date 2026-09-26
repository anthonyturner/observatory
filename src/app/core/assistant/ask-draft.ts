import { Injectable, signal } from '@angular/core';

/** Words heard through the mic for the box to take in; `n` counts them, so
 *  the same words heard twice still arrive twice. */
export interface HeardWords {
  readonly words: string;
  readonly n: number;
}

/** What the Ask box holds, as far as the feed needs to know: whether it is
 *  empty, and words heard to add to it. The box and the feed meet here, so
 *  neither knows the other. */
@Injectable({ providedIn: 'root' })
export class AskDraft {
  private readonly empty = signal(true);
  private readonly added = signal<HeardWords | null>(null);

  readonly isEmpty = this.empty.asReadonly();
  readonly heard = this.added.asReadonly();

  /** The box's words, whenever they change. */
  noteBox(text: string): void {
    this.empty.set(!text.trim());
  }

  /** Puts `words` in the box, after whatever is there, for the owner to send. */
  add(words: string): void {
    this.added.set({ words, n: (this.added()?.n ?? 0) + 1 });
    this.empty.set(false);
  }
}
