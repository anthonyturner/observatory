import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  output,
  untracked,
  viewChild,
} from '@angular/core';
import { ReplyFocusRequest } from '../../../core/assistant/reply-focus';
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
  /** A request for a reply's first button to take the focus. */
  readonly focusRequest = input<ReplyFocusRequest | null>(null);
  readonly pressed = output<EntryAction>();
  readonly stopSpeaking = output<void>();
  /** Open it, after Stay here: the page to go to after all. */
  readonly followed = output<string>();

  protected readonly spans = computed(() => codeSpans(this.entry().said.text));

  private readonly acts = viewChild.required<ElementRef<HTMLElement>>('acts');
  private readonly injector = inject(Injector);
  /** The request seen last; undefined until the first is seen. A card drawn
   *  after a request, as one folding into Earlier, does not act on it. */
  private seenRequest: ReplyFocusRequest | null | undefined;

  constructor() {
    effect(() => {
      const request = this.focusRequest();
      const isNew = this.seenRequest !== undefined && request !== this.seenRequest;
      this.seenRequest = request;
      if (isNew && request?.entryId === untracked(this.entry).id) {
        afterNextRender(() => this.focusFirstAction(), { injector: this.injector });
      }
    });
  }

  protected follow(event: MouseEvent, url: string): void {
    // A modified click opens a new tab, as any link does.
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.button !== 0) return;
    event.preventDefault();
    this.followed.emit(url);
  }

  private focusFirstAction(): void {
    this.acts().nativeElement.querySelector('button')?.focus();
  }
}
