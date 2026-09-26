import { ChangeDetectionStrategy, Component, computed, inject, output } from '@angular/core';
import { MotionPreference } from '../../../core/motion/motion-preference';

/** The orrery's controls: zoom, Fit, and Motion. */
@Component({
  selector: 'app-orrery-tools',
  templateUrl: './orrery-tools.html',
  styleUrl: './orrery-tools.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrreryTools {
  readonly zoomOut = output<void>();
  readonly zoomIn = output<void>();
  readonly fit = output<void>();

  protected readonly motion = inject(MotionPreference);
  protected readonly isMoving = computed(() => !this.motion.isStill());
}
