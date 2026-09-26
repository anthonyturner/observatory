import { Injectable, Signal, effect, inject, signal } from '@angular/core';
import { ProjectProgress, progressBetween } from './project-progress';
import { ProjectSnapshot } from './project.types';
import { PROJECTS_STATE } from './projects-source';

/** Progress seen in one new report. `id` is new each time, so the same
 *  progress twice celebrates twice. */
export interface ProgressMoment {
  readonly id: number;
  readonly progress: readonly ProjectProgress[];
}

/** Compares each projects report with the one before it and says what got
 *  done. The first report only sets the baseline, so nothing celebrates on load. */
@Injectable({ providedIn: 'root' })
export class ProgressFeed {
  private readonly state = inject(PROJECTS_STATE);
  private readonly moment = signal<ProgressMoment | null>(null);
  private previous: { readonly at: string; readonly projects: readonly ProjectSnapshot[] } | null =
    null;
  private nextId = 0;

  readonly latest: Signal<ProgressMoment | null> = this.moment.asReadonly();

  constructor() {
    effect(() => {
      const state = this.state();
      if (state.status !== 'ready' || state.report.generatedAt === this.previous?.at) return;
      const { generatedAt, projects } = state.report;
      if (this.previous) this.announce(progressBetween(this.previous.projects, projects));
      this.previous = { at: generatedAt, projects };
    });
  }

  private announce(progress: readonly ProjectProgress[]): void {
    if (!progress.length) return;
    this.nextId++;
    this.moment.set({ id: this.nextId, progress });
  }
}
