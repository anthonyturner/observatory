import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  linkedSignal,
  output,
} from '@angular/core';
import { CLIPBOARD_WRITER } from '../../../core/clipboard/clipboard-writer';
import { logCardView } from '../../../core/logs/log-card';
import { LogStar } from '../../../core/logs/log-layout';
import { LogSnapshot } from '../../../core/logs/log-snapshot';

const COPY = 'Copy message';
const COPIED = 'Copied';
const COPY_BLOCKED = 'Copy blocked — select the text above';

/** A log star's card: a fault's message, when and where it fired, Copy
 *  message and Find in code; or a quiet window's lines. */
@Component({
  selector: 'app-log-card',
  templateUrl: './log-card.html',
  styleUrl: './log-card.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown.escape)': 'closed.emit()' },
})
export class LogCard {
  readonly star = input.required<LogStar>();
  readonly snapshot = input.required<LogSnapshot>();
  /** `owner/name`, for Find in code. */
  readonly repo = input<string | null>(null);
  /** × or Esc: the page keeps the star's threads and lifetime up. */
  readonly closed = output<void>();

  private readonly clipboard = inject(CLIPBOARD_WRITER);
  protected readonly view = computed(() => logCardView(this.star(), this.snapshot(), this.repo()));
  /** Each star's card starts ready to copy. */
  protected readonly copyLabel = linkedSignal({ source: this.star, computation: () => COPY });

  protected copy(message: string): void {
    this.clipboard.write(message).then(
      () => this.copyLabel.set(COPIED),
      () => this.copyLabel.set(COPY_BLOCKED),
    );
  }
}
