import { Injectable, signal } from '@angular/core';

const STORAGE_KEY = 'observatory.diff-wrap';
/** Stored only once scrolling is picked: wrapping is the default. */
const SCROLL = 'scroll';

/** Whether diffs wrap long lines under their code or scroll them sideways, as
 *  last picked in this browser; wrapping until scrolling is picked. */
@Injectable({ providedIn: 'root' })
export class DiffWrapChoice {
  private readonly picked = signal(readStoredWrap());

  readonly wraps = this.picked.asReadonly();

  choose(wraps: boolean): void {
    this.picked.set(wraps);
    storeWrap(wraps);
  }
}

/** Private windows and blocked site data throw here; wrapping then holds. */
function readStoredWrap(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== SCROLL;
  } catch {
    return true;
  }
}

/** Where storage is blocked the choice lasts for this visit only, which is still useful. */
function storeWrap(wraps: boolean): void {
  try {
    if (wraps) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, SCROLL);
  } catch {
    return;
  }
}
