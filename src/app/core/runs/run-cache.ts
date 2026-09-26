import { DOCUMENT, Injectable, InjectionToken, inject } from '@angular/core';
import { isObject, isText } from '../json/json-fields';

/** What this tab keeps of a run for a reload. The cap stays well inside the
 *  browser's storage quota, about 5 MB a site; a run with more output than
 *  that is read from the start again instead. */
export const RUN_CACHE_CHARS = 1_000_000;
const RUN_CACHE_KEY = 'observatory.run';

/** Where a run's lines wait for a reload. The output can hold what Claude
 *  read, so it is sessionStorage, which ends with the tab. Null where the
 *  browser blocks storage: a reload then reads the run from the start. */
export const RUN_CACHE_STORAGE = new InjectionToken<Storage | null>('RunCacheStorage', {
  providedIn: 'root',
  factory: () => {
    try {
      return inject(DOCUMENT).defaultView?.sessionStorage ?? null;
    } catch {
      return null;
    }
  },
});

/** The lines of a followed run, as the runner sent them, until there are too
 *  many to keep. */
export class RunLines {
  private kept: string[] = [];
  private chars = 0;
  private isOver = false;

  /** The lines, or none once they passed the cap. */
  get lines(): readonly string[] {
    return this.kept;
  }

  add(line: string): void {
    if (this.isOver) return;
    this.kept.push(line);
    this.chars += line.length;
    if (this.chars <= RUN_CACHE_CHARS) return;
    this.isOver = true;
    this.kept = [];
  }
}

/** A run's lines kept across a reload of this tab. */
@Injectable({ providedIn: 'root' })
export class RunCache {
  private readonly storage = inject(RUN_CACHE_STORAGE);

  keep(id: string, lines: readonly string[]): void {
    try {
      this.storage?.setItem(RUN_CACHE_KEY, JSON.stringify({ id, lines }));
    } catch {
      // Over the quota, or storage turned off since: nothing kept is better than half.
      this.clear();
    }
  }

  /** The lines kept for run `id`, or null when none were, or for another run. */
  read(id: string): readonly string[] | null {
    let kept: unknown;
    try {
      kept = JSON.parse(this.storage?.getItem(RUN_CACHE_KEY) ?? 'null');
    } catch {
      return null;
    }
    if (!isObject(kept) || kept['id'] !== id || !Array.isArray(kept['lines'])) return null;
    return kept['lines'].filter(isText);
  }

  clear(): void {
    try {
      this.storage?.removeItem(RUN_CACHE_KEY);
    } catch {
      return;
    }
  }
}
