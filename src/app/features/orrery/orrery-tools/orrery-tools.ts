import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { MotionPreference } from '../../../core/motion/motion-preference';

/** A canvas's camera controls: zoom, Fit, and Motion, with a hint of what to do. */
@Component({
  selector: 'app-orrery-tools',
  templateUrl: './orrery-tools.html',
  styleUrl: './orrery-tools.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrreryTools {
  readonly hint = input('drag · scroll · click a world');
  readonly zoomOut = output<void>();
  readonly zoomIn = output<void>();
  readonly fit = output<void>();

  protected readonly motion = inject(MotionPreference);
  protected readonly isMoving = computed(() => !this.motion.isStill());
}
