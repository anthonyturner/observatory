import { DOCUMENT, Injectable, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter, fromEvent } from 'rxjs';

const STORAGE_KEY = 'observatory.diff-wrap';
/** Stored only once scrolling is picked: wrapping is the default. */
const SCROLL = 'scroll';

/** Whether diffs wrap long lines under their code or scroll them sideways, as
 *  last picked in this browser, in any of its tabs; wrapping until scrolling is picked. */
@Injectable({ providedIn: 'root' })
export class DiffWrapChoice {
  private readonly picked = signal(readStoredWrap());

  readonly wraps = this.picked.asReadonly();

  constructor() {
    // Another tab's pick arrives as it stores it; clearing storage (a null key) means wrapping.
    const view = inject(DOCUMENT).defaultView;
    if (!view) return;
    fromEvent<StorageEvent>(view, 'storage')
      .pipe(
        filter(({ key }) => key === STORAGE_KEY || key === null),
        takeUntilDestroyed(),
      )
      .subscribe(({ newValue }) => this.picked.set(newValue !== SCROLL));
  }

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
