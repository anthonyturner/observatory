import { InjectionToken, Signal, inject } from '@angular/core';
import { CoreChip } from './core-chips';
import { CoreStateStore } from './core-state-store';
import { CoreRunWriter, CoreStateSource, CoreStateWriter, CoreTier } from './core-state.types';

/** Where the core's sources write what the assistant and voice are doing. */
export const CORE_STATE_WRITER = new InjectionToken<CoreStateWriter>('CORE_STATE_WRITER', {
  providedIn: 'root',
  factory: () => inject(CoreStateStore),
});

/** Where a running task writes to the core. */
export const CORE_RUN_WRITER = new InjectionToken<CoreRunWriter>('CORE_RUN_WRITER', {
  providedIn: 'root',
  factory: () => inject(CoreStateStore),
});

/** The chip lit under the core, which the status line names too. */
export const CORE_CHIP = new InjectionToken<Signal<CoreChip>>('CORE_CHIP', {
  providedIn: 'root',
  factory: () => inject(CoreStateStore).chip,
});

/** The tier of the reply being read aloud, whose arc the core lights. */
export const CORE_SPOKEN_TIER = new InjectionToken<Signal<CoreTier>>('CORE_SPOKEN_TIER', {
  providedIn: 'root',
  factory: () => inject(CoreStateStore).spokenTier,
});

/** Everything that drives the core; each is provided with `multi: true`. */
export const CORE_STATE_SOURCES = new InjectionToken<readonly CoreStateSource[]>(
  'CORE_STATE_SOURCES',
);
