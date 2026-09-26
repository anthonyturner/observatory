import { Injectable, signal } from '@angular/core';

/** Whether Home's help card is open. The button, the shortcut and the card
 *  each talk to this, never to each other. */
@Injectable({ providedIn: 'root' })
export class HelpState {
  private readonly open = signal(false);

  readonly isOpen = this.open.asReadonly();

  toggle(): void {
    this.open.update((isOpen) => !isOpen);
  }

  close(): void {
    this.open.set(false);
  }
}
