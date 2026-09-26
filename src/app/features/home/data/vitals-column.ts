import { InjectionToken, Signal, computed, inject } from '@angular/core';
import { Clock } from '../../../core/time/clock';
import { UsageFeed } from '../../../core/usage/usage-feed';
import { usageMeters } from './usage-meters';
import { SAMPLE_VITALS_COLUMN, VitalsColumn } from './vitals';

/** Where Home's left column reads from. The usage meters are live from
 *  pr-starmap's site; issues, directives and documents are still samples. */
export const VITALS_COLUMN = new InjectionToken<Signal<VitalsColumn>>('VITALS_COLUMN', {
  providedIn: 'root',
  factory: () => {
    const usage = inject(UsageFeed).state;
    const now = inject(Clock).now;
    const sampleIssues = SAMPLE_VITALS_COLUMN.vitals.filter((vital) => vital.id === 'issues');
    return computed(() => {
      const meters = usageMeters(usage(), now().getTime());
      return {
        ...SAMPLE_VITALS_COLUMN,
        vitals: [meters.tokens, ...sampleIssues, meters.fiveHour],
        weekly: meters.weekly,
      };
    });
  },
});
