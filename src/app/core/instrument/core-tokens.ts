import { ErrorHandler, InjectionToken, Signal, computed, inject, signal } from '@angular/core';
import { PROJECTS_STATE } from '../projects/projects-source';
import { Canvas2DCoreRenderer } from './canvas-2d/canvas-2d-core-renderer';
import { CoreMood, UNKNOWN_MOOD, moodOf } from './core-mood';
import { CoreRenderer } from './core-renderer';
import { CoreStateId } from './core-states';
import { PreferredCoreRenderer } from './preferred-core-renderer';

/** What the core is doing: idle until the assistant lands and drives it. */
export const CORE_STATE = new InjectionToken<Signal<CoreStateId>>('CORE_STATE', {
  providedIn: 'root',
  factory: () => signal<CoreStateId>('idle').asReadonly(),
});

/** How the projects stand: unknown until they are read, then calm to strained. */
export const CORE_MOOD = new InjectionToken<Signal<CoreMood>>('CORE_MOOD', {
  providedIn: 'root',
  factory: () => {
    const projects = inject(PROJECTS_STATE);
    return computed(() => {
      const state = projects();
      return state.status === 'ready' ? moodOf(state.report.projects) : UNKNOWN_MOOD;
    });
  },
});

/** Makes the renderer each core draws with: WebGL once three.js has loaded
 *  in its own chunk, Canvas 2D until then and wherever WebGL fails. */
export const CORE_RENDERER = new InjectionToken<() => CoreRenderer>('CORE_RENDERER', {
  providedIn: 'root',
  factory: () => {
    const errors = inject(ErrorHandler);
    return () =>
      new PreferredCoreRenderer({
        preferred: () =>
          import('./webgl/webgl-core-renderer').then((module) => new module.WebGLCoreRenderer()),
        fallback: () => new Canvas2DCoreRenderer(),
        onFallback: (reason) => errors.handleError(reason),
      });
  },
});
