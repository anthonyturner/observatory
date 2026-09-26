import { InjectionToken, Signal, computed, inject } from '@angular/core';
import { CORE_CHIP } from '../../../core/core-state/core-state-tokens';
import { PROJECTS_STATE } from '../../../core/projects/projects-source';
import { Clock } from '../../../core/time/clock';
import { HomeSummary, coreStatusOf, homeSummaryFrom } from './home-summary';

/** Where Home's top bar reads its summary from: the core's state first, then
 *  the live projects. */
export const HOME_SUMMARY = new InjectionToken<Signal<HomeSummary>>('HOME_SUMMARY', {
  providedIn: 'root',
  factory: () => {
    const projects = inject(PROJECTS_STATE);
    const now = inject(Clock).now;
    const chip = inject(CORE_CHIP);
    return computed(() => {
      const summary = homeSummaryFrom(projects(), now().getTime());
      return { ...summary, statuses: [coreStatusOf(chip()), ...summary.statuses] };
    });
  },
});
