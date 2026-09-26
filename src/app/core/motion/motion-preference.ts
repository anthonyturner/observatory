import { DestroyRef, Injectable, Signal, inject, signal } from '@angular/core';

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

/** Whether the page should hold still, from the system's reduced-motion
 *  setting. The top bar's Motion button will override it here. */
@Injectable({ providedIn: 'root' })
export class MotionPreference {
  private readonly prefersStill = signal(false);

  readonly isStill: Signal<boolean> = this.prefersStill.asReadonly();

  constructor() {
    // A DOM without matchMedia (a test's) has no preference to follow.
    if (typeof matchMedia !== 'function') return;
    const query = matchMedia(REDUCED_MOTION);
    const follow = (): void => this.prefersStill.set(query.matches);
    follow();
    query.addEventListener('change', follow);
    inject(DestroyRef).onDestroy(() => query.removeEventListener('change', follow));
  }
}
