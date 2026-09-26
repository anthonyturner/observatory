import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { QueueItem, shownBucket } from '../../../core/queue/queue-report';
import { Draggable } from '../../../shared/draggable/draggable';
import { BY_ID } from '../engine/sky-model';
import { CardContext, cardFacts } from './card-facts';

/** Where the card is left, per viewer. */
const CARD_PLACE_KEY = 'observatory.cardPos';

/**
 * pr-starmap's detail card for a pull request's star: its bucket and number,
 * its title, what the sky knows about it, and what can be done from here.
 */
@Component({
  selector: 'app-star-card',
  imports: [Draggable],
  templateUrl: './star-card.html',
  styleUrl: './star-card.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StarCard {
  readonly item = input.required<QueueItem>();
  readonly context = input.required<CardContext>();
  /** A visitor to the hosted preview cannot change anything. */
  readonly canWrite = input(true);
  readonly closed = output<void>();
  /** Asks for the pull request's full screen. */
  readonly open = output<number>();
  readonly snooze = output<number>();
  readonly dismiss = output<number>();

  protected readonly placeKey = CARD_PLACE_KEY;
  protected readonly bucket = computed(() => BY_ID.get(shownBucket(this.item())));
  protected readonly facts = computed(() => cardFacts(this.item(), this.context()));
  /** The issue it closes first, linked on GitHub beside the pull request. */
  protected readonly issueUrl = computed(() => {
    const item = this.item();
    const first = item.closes[0];
    return first === undefined ? null : item.url.replace(/\/pull\/\d+$/, `/issues/${first}`);
  });
}
