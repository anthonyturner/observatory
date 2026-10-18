import { Injectable, signal } from '@angular/core';

const STORAGE_KEY = 'observatory.timeline';
const SHUT = 'shut';
const OPEN = 'open';

/** Whether the queue's timeline is open: folded away until opened, and
 *  remembered in this browser where storage works. */
@Injectable({ providedIn: 'root' })
export class TimelineFold {
  private readonly opened = signal(readStoredOpen());

  readonly isOpen = this.opened.asReadonly();

  toggle(): void {
    const isOpen = !this.opened();
    this.opened.set(isOpen);
    storeOpen(isOpen);
  }
}

function readStoredOpen(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === OPEN;
  } catch {
    return false;
  }
}

/** Where storage is blocked the fold lasts for this visit only. */
function storeOpen(isOpen: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, isOpen ? OPEN : SHUT);
  } catch {
    return;
  }
}
