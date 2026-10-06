import { Injectable, Signal } from '@angular/core';
import { StoredWholeNumber } from '../../../core/settings/stored-whole-number';

/** Open pull requests before the queue nudges, unless the viewer chose otherwise. */
export const DEFAULT_WIP_LIMIT = 8;
export const MIN_WIP_LIMIT = 1;
export const MAX_WIP_LIMIT = 50;
const STORAGE_KEY = 'observatory.wip-limit';

/** How many open pull requests the viewer means to have in flight at once,
 *  remembered in this browser. */
@Injectable({ providedIn: 'root' })
export class WipLimitSetting extends StoredWholeNumber {
  readonly limit: Signal<number> = this.value;

  constructor() {
    super(STORAGE_KEY, { min: MIN_WIP_LIMIT, max: MAX_WIP_LIMIT, fallback: DEFAULT_WIP_LIMIT });
  }
}
