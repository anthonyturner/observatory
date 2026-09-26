import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MotionPreference } from '../../../core/motion/motion-preference';
import { DataAge } from '../../../core/projects/data-age';

/** The veil over the core and the sky as the projects report ages. It sits
 *  under the page's words, so they stay readable however thick it gets. */
@Component({
  selector: 'app-data-fog',
  template: `@if (level() > 0) {
    <span class="veil"></span>
    <span class="wisp one"></span>
    <span class="wisp two"></span>
    <span class="wisp three"></span>
  }`,
  styleUrl: './data-fog.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[style.--fog]': 'level()', '[class.still]': 'motion.isStill()' },
})
export class DataFog {
  protected readonly motion = inject(MotionPreference);
  private readonly age = inject(DataAge);
  protected readonly level = computed(() => this.age.fog().level);
}
