import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  afterNextRender,
  inject,
  input,
  signal,
} from '@angular/core';
import { RunProposal } from '../../../core/assistant/proposal';
import { MotionPreference } from '../../../core/motion/motion-preference';
import { RunOffer } from '../../../core/runs/run-offer';
import { ProposalFrame } from '../proposal-frame/proposal-frame';

/** A task the local site can run: what would run, where and how, with Run.
 *  Only a press of Run itself starts it. */
@Component({
  selector: 'app-run-card',
  imports: [ProposalFrame],
  templateUrl: './run-card.html',
  styleUrl: './run-card.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [RunOffer],
  host: { '[class.still]': 'motion.isStill()' },
})
export class RunCard implements OnInit {
  readonly proposal = input.required<RunProposal>();

  protected readonly offer = inject(RunOffer);
  protected readonly motion = inject(MotionPreference);
  /** Set once drawn, so Run's fill runs from empty as it arms. */
  protected readonly isArming = signal(false);

  constructor() {
    afterNextRender(() => this.isArming.set(true));
  }

  ngOnInit(): void {
    this.offer.offer(this.proposal());
  }
}
