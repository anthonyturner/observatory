import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CommandProposal } from '../../../core/assistant/proposal';
import { CopyButton } from '../../../shared/copy-button/copy-button';
import { ProposalFrame } from '../proposal-frame/proposal-frame';

/** A task, as the command to run it in the project's folder. */
@Component({
  selector: 'app-proposal-card',
  imports: [ProposalFrame, CopyButton],
  templateUrl: './proposal-card.html',
  styleUrl: './proposal-card.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProposalCard {
  readonly proposal = input.required<CommandProposal>();
  readonly dismissed = output<void>();
}
