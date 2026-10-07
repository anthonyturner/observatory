import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { Clock } from '../../../core/time/clock';
import { agoText } from '../../starmap/starmap-usage/usage-text';

const MINUTE_MS = 60_000;

/** "2 min ago", on its own minute clock, so a list of them is not rebuilt each tick. */
@Component({
  selector: 'app-time-ago',
  template: `<time [attr.datetime]="at()">{{ text() }}</time>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TimeAgo {
  /** An ISO time. */
  readonly at = input.required<string>();

  private readonly clock = inject(Clock);
  /** Changes once a minute, though the clock ticks every second. */
  private readonly minute = computed(() => Math.floor(this.clock.now().getTime() / MINUTE_MS));
  protected readonly text = computed(() => agoText(this.at(), this.minute() * MINUTE_MS));
}
