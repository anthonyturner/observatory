import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { LogFilter } from '../../../core/logs/log-levels';
import { LogSkyLayout, LogStar } from '../../../core/logs/log-layout';
import { logListSections } from '../../../core/logs/log-list';

/** The Log Sky as rows: every fault, grouped by window, worst window first. A
 *  row picks its star, which the page flies to. */
@Component({
  selector: 'app-log-list',
  templateUrl: './log-list.html',
  styleUrl: './log-list.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LogList {
  readonly layout = input.required<LogSkyLayout>();
  readonly filter = input<LogFilter>(null);
  readonly picked = output<LogStar>();

  protected readonly sections = computed(() => logListSections(this.layout(), this.filter()));

  protected onKey(event: KeyboardEvent, star: LogStar): void {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    this.picked.emit(star);
  }
}
