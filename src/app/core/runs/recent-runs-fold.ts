import { Injectable, signal } from '@angular/core';

const STORAGE_KEY = 'observatory.recentRuns';
const SHUT = 'shut';
const OPEN = 'open';

/** Whether Recent runs is open: open until folded, and remembered in this
 *  browser where storage works. */
@Injectable({ providedIn: 'root' })
export class RecentRunsFold {
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
    return localStorage.getItem(STORAGE_KEY) !== SHUT;
  } catch {
    return true;
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
