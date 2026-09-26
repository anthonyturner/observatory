import { ErrorHandler, InjectionToken, Signal, inject, signal } from '@angular/core';
import { Canvas2DCoreRenderer } from './canvas-2d/canvas-2d-core-renderer';
import { CoreRenderer } from './core-renderer';
import { CoreStateId } from './core-states';
import { PreferredCoreRenderer } from './preferred-core-renderer';

/** What the core is doing: idle until the assistant lands and drives it. */
export const CORE_STATE = new InjectionToken<Signal<CoreStateId>>('CORE_STATE', {
  providedIn: 'root',
  factory: () => signal<CoreStateId>('idle').asReadonly(),
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
