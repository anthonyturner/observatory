import { InjectionToken, Signal, computed, inject } from '@angular/core';
import { PROJECTS_STATE } from '../../../core/projects/projects-source';
import { Clock } from '../../../core/time/clock';
import { HomeSummary, homeSummaryFrom } from './home-summary';

/** Where Home's top bar reads its summary from: the live projects. */
export const HOME_SUMMARY = new InjectionToken<Signal<HomeSummary>>('HOME_SUMMARY', {
  providedIn: 'root',
  factory: () => {
    const projects = inject(PROJECTS_STATE);
    const now = inject(Clock).now;
    return computed(() => homeSummaryFrom(projects(), now().getTime()));
  },
});
