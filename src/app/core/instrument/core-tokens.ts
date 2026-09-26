import { InjectionToken, Signal, signal } from '@angular/core';
import { CoreStateId } from './core-states';
import { Canvas2DCoreRenderer } from './canvas-2d/canvas-2d-core-renderer';
import { CoreRenderer } from './core-renderer';

/** What the core is doing: idle until the assistant lands and drives it. */
export const CORE_STATE = new InjectionToken<Signal<CoreStateId>>('CORE_STATE', {
  providedIn: 'root',
  factory: () => signal<CoreStateId>('idle').asReadonly(),
});

/** Makes the renderer each core draws with: Canvas 2D until the 3D one lands. */
export const CORE_RENDERER = new InjectionToken<() => CoreRenderer>('CORE_RENDERER', {
  providedIn: 'root',
  factory: () => () => new Canvas2DCoreRenderer(),
});
