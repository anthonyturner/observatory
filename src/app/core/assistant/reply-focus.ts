import { Injectable, signal } from '@angular/core';

/** A reply asked to take the focus to its first button. */
export interface ReplyFocusRequest {
  readonly entryId: number;
}

/** Sends the focus to a reply's first button, so a keyboard press lands
 *  where the next step is, as after a skill's reply asks which project. */
@Injectable({ providedIn: 'root' })
export class ReplyFocus {
  private readonly latest = signal<ReplyFocusRequest | null>(null);

  /** Each request is a new object, so asking twice for one reply still moves the focus. */
  readonly firstAction = this.latest.asReadonly();

  focusFirstAction(entryId: number): void {
    this.latest.set({ entryId });
  }
}
