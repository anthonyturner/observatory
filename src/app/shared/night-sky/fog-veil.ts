import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { MotionPreference } from '../../core/motion/motion-preference';

/** A veil of drifting fog over a sky, 0 clear to 1 full. It sits under the
 *  page's words, so they stay readable however thick it gets. */
@Component({
  selector: 'app-fog-veil',
  template: `@if (level() > 0) {
    <span class="veil"></span>
    <span class="wisp one"></span>
    <span class="wisp two"></span>
    <span class="wisp three"></span>
  }`,
  styleUrl: './fog-veil.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[style.--fog]': 'level()', '[class.still]': 'motion.isStill()' },
})
export class FogVeil {
  readonly level = input.required<number>();
  protected readonly motion = inject(MotionPreference);
}
