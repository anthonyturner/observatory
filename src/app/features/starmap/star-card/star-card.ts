import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { QueueItem, isFlakyOnly, shownBucket } from '../../../core/queue/queue-report';
import { sinceLookLabel } from '../../../core/queue/since-look';
import { Draggable } from '../../../shared/draggable/draggable';
import { CrewControl } from '../crew-control/crew-control';
import { RerunControl } from '../rerun-control/rerun-control';
import { isPlainClick } from '../../issues/issue-list';
import { BY_ID } from '../engine/sky-model';
import { CardContext, cardFacts } from './card-facts';
import { StarRisk } from './star-risk/star-risk';

/** Where the card is left, per viewer. */
const CARD_PLACE_KEY = 'observatory.cardPos';

/**
 * pr-starmap's detail card for a pull request's star: its bucket and number,
 * its title, its risk at a glance, what the sky knows about it, and what can
 * be done from here.
 */
@Component({
  selector: 'app-star-card',
  imports: [Draggable, CrewControl, RerunControl, StarRisk],
  templateUrl: './star-card.html',
  styleUrl: './star-card.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StarCard {
  readonly repo = input.required<string>();
  readonly item = input.required<QueueItem>();
  readonly context = input.required<CardContext>();
  /** A visitor to the hosted preview cannot change anything. */
  readonly canWrite = input(true);
  readonly closed = output<void>();
  /** Asks for the pull request's full screen. */
  readonly open = output<number>();
  readonly snooze = output<number>();
  readonly dismiss = output<number>();
  /** Asks to read the issue it closes in the issue window. */
  readonly issue = output<number>();
  /** GitHub took a rerun of its flaky checks. */
  readonly rerun = output<number>();

  protected readonly placeKey = CARD_PLACE_KEY;
  protected readonly shown = computed(() => shownBucket(this.item()));
  protected readonly bucket = computed(() => BY_ID.get(this.shown()));
  protected readonly facts = computed(() => cardFacts(this.item(), this.context()));
  /** The merge of the base it was stacked on, which a crew can update it from. */
  protected readonly landed = computed(() => this.context().stack?.landed ?? null);
  /** Failing only on flaky checks, where a rerun can be asked for. */
  protected readonly canRerun = computed(
    () => this.canWrite() && !this.context().replay && isFlakyOnly(this.item()),
  );
  /** What changed since it was last looked at; a past refresh on screen says nothing of now. */
  protected readonly sinceLook = computed(() => {
    const since = this.item().sinceLook;
    return since && !this.context().replay ? sinceLookLabel(since) : null;
  });
  /** The issue it closes first, linked on GitHub beside the pull request. */
  protected readonly issueUrl = computed(() => {
    const item = this.item();
    const first = item.closes[0];
    return first === undefined ? null : item.url.replace(/\/pull\/\d+$/, `/issues/${first}`);
  });

  /** A plain click reads the issue here; any other follows the link to GitHub. */
  protected onIssue(event: MouseEvent): void {
    const first = this.item().closes[0];
    if (first === undefined || !isPlainClick(event)) return;
    event.preventDefault();
    this.issue.emit(first);
  }
}
