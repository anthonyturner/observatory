import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { HudSection } from '../../../../shared/hud-section/hud-section';
import { HOT_PERCENT, WeeklyUsage } from '../../data/vitals';

const SCALE_MARKS = [0, 25, 50, 75, 100] as const;

const clampPercent = (value: number): number => Math.min(100, Math.max(0, value));

/** The weekly limit, framed as a mounted gauge: corner brackets, the percent
 *  used, and a meter of twenty ticks, one per 5%. */
@Component({
  selector: 'app-weekly-gauge',
  imports: [HudSection],
  templateUrl: './weekly-gauge.html',
  styleUrl: './weekly-gauge.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.hot]': 'isHot()' },
})
export class WeeklyGauge {
  readonly usage = input.required<WeeklyUsage>();

  protected readonly scaleMarks = SCALE_MARKS;
  protected readonly fillPercent = computed(() => {
    const used = this.usage().percentUsed;
    return used === null ? null : clampPercent(used);
  });
  protected readonly isHot = computed(() => (this.usage().percentUsed ?? 0) >= HOT_PERCENT);
}
