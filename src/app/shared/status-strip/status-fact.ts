import { InjectionToken, Signal } from '@angular/core';

/** One always-on fact the status strip carries. A fact component provides
 *  itself under {@link STATUS_FACT} and the strip shows while any fact has
 *  something to say. */
export interface StatusFact {
  readonly isShown: Signal<boolean>;
}

export const STATUS_FACT = new InjectionToken<StatusFact>('STATUS_FACT');

/** What a fact needs to know of the strip it sits in. */
export interface StatusStripView {
  /** Folded to a compact chip, where a fact shows only its headline. */
  readonly isCollapsed: Signal<boolean>;
}

export const STATUS_STRIP_VIEW = new InjectionToken<StatusStripView>('STATUS_STRIP_VIEW');
