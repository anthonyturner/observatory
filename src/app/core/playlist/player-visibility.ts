import { Injectable, signal } from '@angular/core';

const STORAGE_KEY = 'observatory.playerShown';
const HIDDEN = 'hidden';
const SHOWN = 'shown';

/** Whether the playlist player takes the bottom-right corner or is put away, leaving
 *  only its toggle: shown until hidden, and remembered in this browser where storage works. */
@Injectable({ providedIn: 'root' })
export class PlayerVisibility {
  private readonly shown = signal(readStoredShown());

  readonly isShown = this.shown.asReadonly();

  toggle(): void {
    const isShown = !this.shown();
    this.shown.set(isShown);
    storeShown(isShown);
  }
}

function readStoredShown(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== HIDDEN;
  } catch {
    return true;
  }
}

/** Where storage is blocked the choice lasts for this visit only. */
function storeShown(isShown: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, isShown ? SHOWN : HIDDEN);
  } catch {
    return;
  }
}
