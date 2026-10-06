import { Injectable, Signal } from '@angular/core';
import { StoredWholeNumber } from '../../../core/settings/stored-whole-number';

/** Idle days before a pull request starts to fall, unless the viewer chose otherwise. */
export const DEFAULT_STALE_DAYS = 14;
/** The same range a snooze allows. */
export const MIN_STALE_DAYS = 1;
export const MAX_STALE_DAYS = 90;
const STORAGE_KEY = 'observatory.black-hole-days';

/** How long a pull request may sit idle before the black hole pulls it in,
 *  remembered in this browser. */
@Injectable({ providedIn: 'root' })
export class BlackHoleSetting extends StoredWholeNumber {
  readonly staleAfterDays: Signal<number> = this.value;

  constructor() {
    super(STORAGE_KEY, {
      min: MIN_STALE_DAYS,
      max: MAX_STALE_DAYS,
      fallback: DEFAULT_STALE_DAYS,
    });
  }
}
