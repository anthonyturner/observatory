import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MotionPreference } from '../../../core/motion/motion-preference';
import { PAGE_REFRESH } from '../../../core/projects/projects-refresh';
import { TrailActivity } from '../../../core/sky/trail-activity';
import { TRAIL_SPEEDS, TrailSpeed } from '../../../core/sky/trail-speed';
import { SoundPreference } from '../../../core/sound/sound-preference';
import { HelpState } from '../../../shared/help/help-state';

/** Home's controls along the foot of the screen, as the orrery's and the star map's
 *  are: Refresh, the star trails' Spin, then Motion, Sound and Help. On a phone they
 *  fold behind one Tools button, so the foot keeps the screen for the page. */
@Component({
  selector: 'app-home-tools',
  templateUrl: './home-tools.html',
  styleUrl: './home-tools.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.open]': 'isOpen()' },
})
export class HomeTools {
  protected readonly help = inject(HelpState);
  protected readonly motion = inject(MotionPreference);
  protected readonly sound = inject(SoundPreference);
  protected readonly spin = inject(TrailSpeed);
  private readonly page = inject(PAGE_REFRESH);
  protected readonly refreshing = signal(false);
  protected readonly isOpen = signal(false);
  protected readonly lastStop = TRAIL_SPEEDS.length - 1;
  protected readonly spinLabel = computed(() => `${this.spin.multiplier()}×`);
  private readonly activity = inject(TrailActivity).measured;
  protected readonly spinHint = computed(() => {
    const pace = this.activity();
    return pace === null
      ? 'How fast the star trails turn. 1× is their natural pace: there is no Claude Code usage to compare today with'
      : `How fast the star trails turn. 1× is today's pace: ${pace}× a usual day's Claude Code work so far`;
  });
  protected readonly motionHint = computed(() =>
    this.motion.choice() === 'auto'
      ? 'Following your system setting — click to override'
      : 'Overriding your system setting — click to switch',
  );

  /** Every project read again from GitHub now, not from the API's cache. */
  protected async refresh(): Promise<void> {
    this.refreshing.set(true);
    try {
      await this.page.refresh();
    } finally {
      this.refreshing.set(false);
    }
  }

  protected onSpin(event: Event): void {
    this.spin.set(Number((event.target as HTMLInputElement).value));
  }
}
