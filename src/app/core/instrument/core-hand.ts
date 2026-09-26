import { Injectable, Signal, inject, signal } from '@angular/core';
import { MotionPreference } from '../motion/motion-preference';
import { HandState } from './hand';

/** The hand on the core, shared by the surface that takes the pointer and
 *  the canvas that draws what it does. */
@Injectable({ providedIn: 'root' })
export class CoreHand {
  private readonly motion = inject(MotionPreference);
  private readonly touches = signal(0);

  readonly state = new HandState(() => this.motion.isStill());
  /** Changes whenever the hand did something worth a frame. */
  readonly touched: Signal<number> = this.touches.asReadonly();

  /** Asks the core for a frame after the hand moved. */
  redraw(): void {
    this.touches.update((count) => count + 1);
  }
}
