import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CrewDispatch } from '../../../core/crew/crew-dispatch';
import { crewFor, crewTaskOf, crewViewOf } from '../../../core/crew/crew-roster';
import { QueueBucket } from '../../../core/queue/queue-report';
import { LandedBase } from '../../../core/queue/stacks';

/** The card and the PR screen can both be open, so each hint needs its own id. */
let nextHint = 0;

/**
 * Send crew, on the card and screen of a pull request that is conflicted, is
 * failing, or is stacked on a base that has merged: the button, the crew's
 * status while it is out and after, and a link to its log in Home's task
 * panel. Shows nothing where no crew can be sent from.
 */
@Component({
  selector: 'app-crew-control',
  imports: [RouterLink],
  templateUrl: './crew-control.html',
  styleUrl: './crew-control.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CrewControl {
  readonly repo = input.required<string>();
  readonly number = input.required<number>();
  readonly bucket = input.required<QueueBucket | null>();
  /** The merge of the base it was stacked on, once that has merged: a crew updates it. */
  readonly landed = input<LandedBase | null>(null);

  private readonly dispatch = inject(CrewDispatch);

  protected readonly hintId = `crew-hint-${nextHint++}`;

  private readonly crew = computed(() =>
    crewFor(this.dispatch.crews(), this.repo(), this.number()),
  );
  protected readonly view = computed(() => {
    if (!this.dispatch.isAvailable()) return null;
    return crewViewOf({
      task: crewTaskOf(this.bucket(), this.landed()),
      crew: this.crew(),
      isSending: this.dispatch.isSending(this.repo(), this.number()),
      isRunnerBusy: this.dispatch.isRunnerBusy(),
      refusal: this.dispatch.refusalFor(this.repo(), this.number()),
    });
  });

  protected send(): void {
    this.dispatch.send(this.repo(), this.number());
  }

  protected showLog(): void {
    const crew = this.crew();
    if (crew) this.dispatch.showLog(crew);
  }
}
