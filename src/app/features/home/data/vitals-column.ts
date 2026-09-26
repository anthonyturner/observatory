import { InjectionToken, Signal, computed, inject } from '@angular/core';
import { PROJECTS_STATE } from '../../../core/projects/projects-source';
import { Clock } from '../../../core/time/clock';
import { UsageFeed } from '../../../core/usage/usage-feed';
import { openIssuesVital } from './issues-vital';
import { usageMeters } from './usage-meters';
import { SAMPLE_VITALS_COLUMN, VitalsColumn } from './vitals';

/** Where Home's left column reads from. The usage meters and open issues are
 *  live from Observatory's API; directives and documents are still samples. */
export const VITALS_COLUMN = new InjectionToken<Signal<VitalsColumn>>('VITALS_COLUMN', {
  providedIn: 'root',
  factory: () => {
    const usage = inject(UsageFeed).state;
    const projects = inject(PROJECTS_STATE);
    const now = inject(Clock).now;
    return computed(() => {
      const at = now().getTime();
      const meters = usageMeters(usage(), at);
      return {
        ...SAMPLE_VITALS_COLUMN,
        vitals: [meters.tokens, openIssuesVital(projects(), at), meters.fiveHour],
        weekly: meters.weekly,
      };
    });
  },
});
