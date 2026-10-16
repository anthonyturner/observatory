import { InjectionToken, Signal, computed, inject } from '@angular/core';
import { PROJECTS_STATE } from '../../../core/projects/projects-source';
import { Clock } from '../../../core/time/clock';
import { UsageFeed } from '../../../core/usage/usage-feed';
import { directiveListFrom } from './directive-list';
import { openIssuesVital } from './issues-vital';
import { usageMeters } from './usage-meters';
import { VitalsColumn } from './vitals';

/** Where Home's left column reads from: all of it live from Observatory's API. */
export const VITALS_COLUMN = new InjectionToken<Signal<VitalsColumn>>('VITALS_COLUMN', {
  providedIn: 'root',
  factory: () => {
    const usage = inject(UsageFeed).state;
    const projectsState = inject(PROJECTS_STATE);
    const now = inject(Clock).now;
    return computed(() => {
      const at = now().getTime();
      const meters = usageMeters(usage(), at);
      return {
        vitals: [meters.tokens, openIssuesVital(projectsState(), at), meters.fiveHour],
        weekly: meters.weekly,
        directives: directiveListFrom(projectsState()),
      };
    });
  },
});
