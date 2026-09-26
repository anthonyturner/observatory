import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MotionPreference } from '../../../core/motion/motion-preference';
import { SoundPreference } from '../../../core/sound/sound-preference';
import { HelpState } from '../../../shared/help/help-state';

/** The way to the orrery and the page's tools. */
@Component({
  selector: 'app-top-nav',
  imports: [RouterLink],
  templateUrl: './top-nav.html',
  styleUrl: './top-nav.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TopNav {
  protected readonly help = inject(HelpState);
  protected readonly motion = inject(MotionPreference);
  protected readonly sound = inject(SoundPreference);
  protected readonly motionHint = computed(() =>
    this.motion.choice() === 'auto'
      ? 'Following your system setting — click to override'
      : 'Overriding your system setting — click to switch',
  );
}
