import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { formatAt, formatCount } from '../../../core/logs/log-format';
import { LogChangeFailure } from '../../../core/logs/logs-feed';

/**
 * The Log Sky's controls. Clear ignores every error and warning logged up to now, so a fault
 * already fixed stops lighting a star, and Reset counts everything again. The older toggle
 * brings back the faults that stopped firing a day before the newest log line, which the sky
 * leaves out. Presents only: the page decides who may clear and what each press does.
 */
@Component({
  selector: 'app-log-controls',
  templateUrl: './log-controls.html',
  styleUrl: './log-controls.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LogControls {
  /** Whether Clear and Reset are offered: they change the owner's own computer. */
  readonly canClear = input(false);
  /** A log time, or null while every line counts. */
  readonly clearedAt = input<string | null>(null);
  /** A clear, a reset or a fresh read is on its way. */
  readonly isWaiting = input(false);
  /** Why the last press did not take, or null. */
  readonly failure = input<LogChangeFailure | null>(null);
  /** How many faults the sky leaves out as older; the toggle is absent at none. */
  readonly olderCount = input(0);
  readonly isShowingOlder = input(false);
  readonly cleared = output<void>();
  readonly restored = output<void>();
  readonly olderToggled = output<void>();

  protected readonly since = computed(() => {
    const at = this.clearedAt();
    return at ? formatAt(at) : null;
  });
  protected readonly olderLabel = computed(
    () => `${this.isShowingOlder() ? 'Hide' : 'Show'} ${formatCount(this.olderCount())} older`,
  );
}
