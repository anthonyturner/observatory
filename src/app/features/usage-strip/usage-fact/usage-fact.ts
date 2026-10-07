import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Clock } from '../../../core/time/clock';
import { UsageFeed } from '../../../core/usage/usage-feed';
import {
  STATUS_FACT,
  STATUS_STRIP_VIEW,
  StatusFact,
} from '../../../shared/status-strip/status-fact';
import { usageGlance } from '../usage-glance';

const MINUTE_MS = 60_000;

/** Claude Code's two limits in the status strip: each with a small meter and
 *  the nearer reset, or folded, just the higher percent. */
@Component({
  selector: 'app-usage-fact',
  templateUrl: './usage-fact.html',
  styleUrl: './usage-fact.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: STATUS_FACT, useExisting: UsageFact }],
})
export class UsageFact implements StatusFact {
  private readonly usage = inject(UsageFeed).state;
  private readonly now = inject(Clock).now;
  protected readonly strip = inject(STATUS_STRIP_VIEW);

  /** The clock ticks each second; a reset is only checked once a minute. */
  private readonly minute = computed(() => Math.floor(this.now().getTime() / MINUTE_MS));

  protected readonly glance = computed(() => usageGlance(this.usage(), this.minute() * MINUTE_MS));
  readonly isShown = computed(() => this.glance() !== null);
}
