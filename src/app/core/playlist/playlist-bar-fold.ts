import { Injectable, signal } from '@angular/core';

const STORAGE_KEY = 'observatory.playlistBar';
const FOLDED = 'folded';
const OPEN = 'open';
const PHONE = '(max-width: 720px)';

/** Whether Home's playlist bar is folded down to its essentials: open until
 *  folded, folded on a phone, and remembered in this browser where storage works. */
@Injectable({ providedIn: 'root' })
export class PlaylistBarFold {
  private readonly folded = signal(readStoredFolded());

  readonly isFolded = this.folded.asReadonly();

  toggle(): void {
    const isFolded = !this.folded();
    this.folded.set(isFolded);
    storeFolded(isFolded);
  }
}

function readStoredFolded(): boolean {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === FOLDED || (stored !== OPEN && isPhone());
  } catch {
    return isPhone();
  }
}

/** A DOM without matchMedia (a test's) is not a phone. */
function isPhone(): boolean {
  return typeof matchMedia === 'function' && matchMedia(PHONE).matches;
}

/** Where storage is blocked the fold lasts for this visit only. */
function storeFolded(isFolded: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, isFolded ? FOLDED : OPEN);
  } catch {
    return;
  }
}
