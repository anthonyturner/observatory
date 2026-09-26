import { InjectionToken, Signal, computed, inject } from '@angular/core';
import { ProjectSnapshot } from './project.types';
import { ProjectsFeed, ProjectsState } from './projects-feed';

/** Where the projects stand: reading, out of reach, or read. */
export const PROJECTS_STATE = new InjectionToken<Signal<ProjectsState>>('PROJECTS_STATE', {
  providedIn: 'root',
  factory: () => inject(ProjectsFeed).state,
});

/** Every project read so far; empty until the first read lands. */
export const PROJECTS = new InjectionToken<Signal<readonly ProjectSnapshot[]>>('PROJECTS', {
  providedIn: 'root',
  factory: () => {
    const state = inject(PROJECTS_STATE);
    return computed(() => {
      const current = state();
      return current.status === 'ready' ? current.report.projects : [];
    });
  },
});
