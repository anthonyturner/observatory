import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CommandProposal } from '../../../core/assistant/proposal';
import { TASK_CHIP } from '../../../core/assistant/reply-chip';
import { CopyButton } from '../../../shared/copy-button/copy-button';
import { FocusOnArrival } from '../../../shared/focus-on-arrival/focus-on-arrival';
import { ReplyChipLine } from '../reply-chip/reply-chip';

let nextTitleId = 0;

/** A task, as the command to run it in the project's folder. A task is the
 *  requester's to start, so it sits in the warm frame kept for decisions. The
 *  focus goes to its heading, so a stray Enter presses nothing. */
@Component({
  selector: 'app-proposal-card',
  imports: [ReplyChipLine, CopyButton, FocusOnArrival],
  templateUrl: './proposal-card.html',
  styleUrl: './proposal-card.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { role: 'region', '[attr.aria-labelledby]': 'titleId' },
})
export class ProposalCard {
  readonly proposal = input.required<CommandProposal>();
  readonly dismissed = output<void>();

  protected readonly chip = TASK_CHIP;
  protected readonly titleId = `proposal-title-${nextTitleId++}`;
}
