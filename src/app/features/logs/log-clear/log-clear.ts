import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { formatAt } from '../../../core/logs/log-format';

/**
 * The Log Sky's Clear and Reset. Clear ignores every error and warning logged up
 * to now, so a fault already fixed stops lighting a star; Reset counts everything
 * again. Presents only: the page decides who sees it and what each press does.
 */
@Component({
  selector: 'app-log-clear',
  templateUrl: './log-clear.html',
  styleUrl: './log-clear.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LogClear {
  /** A log time, or null while every line counts. */
  readonly clearedAt = input<string | null>(null);
  /** A clear, a reset or a fresh read is on its way. */
  readonly isWaiting = input(false);
  /** The last press did not reach the API. */
  readonly isRefused = input(false);
  readonly cleared = output<void>();
  readonly restored = output<void>();

  protected readonly since = computed(() => {
    const at = this.clearedAt();
    return at ? formatAt(at) : null;
  });
}
