import { Injectable, signal } from '@angular/core';

/** Whether Home's help card is open. The button, the shortcut and the card
 *  each talk to this, never to each other. */
@Injectable({ providedIn: 'root' })
export class HelpState {
  private readonly opened = signal(false);

  readonly isOpen = this.opened.asReadonly();

  toggle(): void {
    this.opened.update((isOpen) => !isOpen);
  }

  open(): void {
    this.opened.set(true);
  }

  close(): void {
    this.opened.set(false);
  }
}
