import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MotionPreference } from '../../../core/motion/motion-preference';
import { HelpState } from '../help/help-state';

/** The way to the orrery and the page's tools. */
@Component({
  selector: 'app-top-nav',
  templateUrl: './top-nav.html',
  styleUrl: './top-nav.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TopNav {
  protected readonly help = inject(HelpState);
  protected readonly motion = inject(MotionPreference);
  protected readonly motionHint = computed(() =>
    this.motion.choice() === 'auto'
      ? 'Following your system setting — click to override'
      : 'Overriding your system setting — click to switch',
  );
}
