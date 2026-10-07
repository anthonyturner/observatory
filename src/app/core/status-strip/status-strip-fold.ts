import { Injectable, signal } from '@angular/core';

const STORAGE_KEY = 'observatory.statusStrip';
const FOLDED = 'folded';
const OPEN = 'open';

/** Whether the status strip is folded to a chip: open until folded, and
 *  remembered in this browser where storage works. */
@Injectable({ providedIn: 'root' })
export class StatusStripFold {
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
    return localStorage.getItem(STORAGE_KEY) === FOLDED;
  } catch {
    return false;
  }
}

/** Where storage is blocked the fold lasts for this visit only. */
function storeFolded(isFolded: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, isFolded ? FOLDED : OPEN);
  } catch {
    return;
  }
}
