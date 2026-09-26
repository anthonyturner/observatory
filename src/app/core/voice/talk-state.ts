import { Injectable, Signal, signal } from '@angular/core';

/** Whether the mic has a turn under way, from the press to the transcript.
 *  A reply is not read aloud over it. */
@Injectable({ providedIn: 'root' })
export class TalkState {
  private readonly talking = signal(false);

  readonly isTalking: Signal<boolean> = this.talking.asReadonly();

  begin(): void {
    this.talking.set(true);
  }

  end(): void {
    this.talking.set(false);
  }
}
