import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { UsageLimits } from '../../../../core/usage/usage-document';
import { pastWeeksChart } from '../charts/past-weeks-chart';
import { UsageColumnChart } from '../charts/usage-column-chart/usage-column-chart';
import { UsageWeekChart } from '../charts/usage-week-chart/usage-week-chart';
import { weekChart } from '../charts/week-chart';
import { limitTiles } from '../limit-tiles';
import { UsageSection } from '../usage-section/usage-section';
import { agoText } from '../usage-text';
import { UsageTiles } from '../usage-tiles/usage-tiles';

/** What a Node status line script adds, after it has parsed its input as
 *  `status`, to record the limits (README, "Live data"). */
export const RECORD_LINE =
  "import('file:///path/to/observatory/server/usage/limit-recorder.ts').then((m) => m.record(status)).catch(() => {});";

/** Plan limits: this week, its pace and the five-hour window, the week so far
 *  reading by reading, and how far earlier weeks got. */
@Component({
  selector: 'app-usage-limits',
  imports: [UsageSection, UsageTiles, UsageWeekChart, UsageColumnChart],
  templateUrl: './usage-limits.html',
  styleUrl: './usage-limits.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UsageLimitsSection {
  readonly limits = input<UsageLimits | undefined>();
  readonly width = input.required<number>();
  /** Epoch ms, a minute at a time. */
  readonly now = input.required<number>();

  protected readonly recordLine = RECORD_LINE;
  protected readonly lastRead = computed(() => {
    const at = this.limits()?.at;
    return at ? `last read ${agoText(at, this.now())}` : '';
  });
  protected readonly tiles = computed(() => {
    const limits = this.limits();
    return limits ? limitTiles(limits) : [];
  });
  /** This week's chart, while the week is current. */
  protected readonly week = computed(() => {
    const week = this.limits()?.week;
    if (!week || week.expired) return null;
    return {
      hasProjection: Boolean(week.projection),
      chart: weekChart({ week, width: this.width(), now: this.now() }),
    };
  });
  protected readonly pastWeeks = computed(() => {
    const weeks = this.limits()?.weeks ?? [];
    return weeks.length ? pastWeeksChart(weeks, this.width()) : null;
  });
}
