import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { MotionPreference } from '../../../core/motion/motion-preference';
import { SoundPreference } from '../../../core/sound/sound-preference';
import { HelpState } from '../../../shared/help/help-state';

/** A canvas's controls: zoom, Fit, Motion, Sound and Help, with a hint of what to do. */
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
  protected readonly sound = inject(SoundPreference);
  protected readonly help = inject(HelpState);
}
