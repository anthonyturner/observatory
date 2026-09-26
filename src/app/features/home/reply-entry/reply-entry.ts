import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { EntryAction, ReplyEntry } from '../../../core/assistant/reply-entry';
import { codeSpans } from '../../../core/text/inline-code';
import { CopyButton } from '../../../shared/copy-button/copy-button';
import { FocusOnArrival } from '../../../shared/focus-on-arrival/focus-on-arrival';
import { ReplyChipLine } from '../reply-chip/reply-chip';

/** One request and its reply: what was asked, the tier chip, what it said,
 *  and its buttons. */
@Component({
  selector: 'app-reply-entry',
  imports: [ReplyChipLine, CopyButton, FocusOnArrival],
  templateUrl: './reply-entry.html',
  styleUrl: './reply-entry.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReplyEntryCard {
  readonly entry = input.required<ReplyEntry>();
  /** True while this reply is being read aloud. */
  readonly isSpeaking = input(false);
  readonly pressed = output<EntryAction>();
  readonly stopSpeaking = output<void>();
  /** Open it, after Stay here: the page to go to after all. */
  readonly followed = output<string>();

  protected readonly spans = computed(() => codeSpans(this.entry().said.text));

  protected follow(event: MouseEvent, url: string): void {
    // A modified click opens a new tab, as any link does.
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.button !== 0) return;
    event.preventDefault();
    this.followed.emit(url);
  }
}
