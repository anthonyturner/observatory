import { DestroyRef, Injectable, Signal, computed, inject, signal } from '@angular/core';

/** `auto` follows the system; `on` and `off` override it. */
export type MotionChoice = 'auto' | 'on' | 'off';

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';
const STORAGE_KEY = 'observatory.motion';

/** Whether the page should hold still: the system's reduced-motion setting,
 *  unless the Motion button has overridden it in this browser. */
@Injectable({ providedIn: 'root' })
export class MotionPreference {
  private readonly systemPrefersStill = signal(false);
  private readonly chosen = signal<MotionChoice>(readStoredChoice());

  readonly choice: Signal<MotionChoice> = this.chosen.asReadonly();
  readonly isStill: Signal<boolean> = computed(() => {
    const choice = this.chosen();
    return choice === 'auto' ? this.systemPrefersStill() : choice === 'off';
  });

  constructor() {
    // A DOM without matchMedia (a test's) has no preference to follow.
    if (typeof matchMedia !== 'function') return;
    const query = matchMedia(REDUCED_MOTION);
    const follow = (): void => this.systemPrefersStill.set(query.matches);
    follow();
    query.addEventListener('change', follow);
    inject(DestroyRef).onDestroy(() => query.removeEventListener('change', follow));
  }

  /** Turns motion on if the page is still, off if it moves, and remembers that. */
  toggle(): void {
    const next: MotionChoice = this.isStill() ? 'on' : 'off';
    this.chosen.set(next);
    storeChoice(next);
  }
}

/** Private windows and blocked site data throw here; the system setting then holds. */
function readStoredChoice(): MotionChoice {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === 'on' || stored === 'off' ? stored : 'auto';
  } catch {
    return 'auto';
  }
}

/** Where storage is blocked the choice lasts for this visit only, which is still useful. */
function storeChoice(choice: MotionChoice): void {
  try {
    localStorage.setItem(STORAGE_KEY, choice);
  } catch {
    return;
  }
}
