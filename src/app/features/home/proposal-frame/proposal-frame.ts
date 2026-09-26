import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TASK_CHIP } from '../../../core/assistant/reply-chip';
import { FocusOnArrival } from '../../../shared/focus-on-arrival/focus-on-arrival';
import { ReplyChipLine } from '../reply-chip/reply-chip';

let nextTitleId = 0;

/** A task proposal's card: a task is the requester's to start, so it sits in
 *  the warm frame kept for decisions. The focus goes to its heading, so a
 *  stray Enter presses nothing. The card's buttons go in `[proposalActs]`. */
@Component({
  selector: 'app-proposal-frame',
  imports: [ReplyChipLine, FocusOnArrival],
  templateUrl: './proposal-frame.html',
  styleUrl: './proposal-frame.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { role: 'region', '[attr.aria-labelledby]': 'titleId' },
})
export class ProposalFrame {
  readonly heading = input.required<string>();
  /** What was heard while the card was up, and why it waits in the box. */
  readonly heard = input<string | null>(null);

  protected readonly chip = TASK_CHIP;
  protected readonly titleId = `proposal-title-${nextTitleId++}`;
}
