import { DOCUMENT, Injectable, inject } from '@angular/core';

const KEY_PREFIX = 'observatory.lastSeen.';

/** When you last looked at each repository's queue, in this browser only. Without
 *  storage (a private window, blocked site data) every visit reads as the first. */
@Injectable({ providedIn: 'root' })
export class LastSeen {
  private readonly window = inject(DOCUMENT).defaultView;

  read(repo: string): number | null {
    try {
      const stored = Number(this.window?.localStorage.getItem(KEY_PREFIX + repo));
      return Number.isFinite(stored) && stored > 0 ? stored : null;
    } catch {
      return null;
    }
  }

  record(repo: string, at: number): void {
    try {
      this.window?.localStorage.setItem(KEY_PREFIX + repo, String(at));
    } catch {
      // A convenience only: the page works without it.
    }
  }
}
