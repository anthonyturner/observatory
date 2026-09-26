import { Injectable, signal } from '@angular/core';

/** Asks for the focus to go back to the Ask box, after a button that took
 *  it has gone: Stay here, Dismiss. The box counts the requests. */
@Injectable({ providedIn: 'root' })
export class AskBoxFocus {
  private readonly count = signal(0);

  readonly requests = this.count.asReadonly();

  request(): void {
    this.count.update((count) => count + 1);
  }
}
