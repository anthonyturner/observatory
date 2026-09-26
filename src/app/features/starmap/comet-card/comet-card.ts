import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { Draggable } from '../../../shared/draggable/draggable';
import { COMET_COLOUR, Comet } from '../comets';

/** An issue idle this long reads hot on its card. */
const HOT_IDLE_DAYS = 30;

/** pr-starmap's card for a comet: an issue no pull request closes. */
@Component({
  selector: 'app-comet-card',
  imports: [Draggable],
  templateUrl: './comet-card.html',
  // The detail card's look, shared with the star's card.
  styleUrl: '../star-card/star-card.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CometCard {
  readonly comet = input.required<Comet>();
  readonly closed = output<void>();
  /** Asks to read the issue in the issue window. */
  readonly open = output<number>();

  protected readonly colour = COMET_COLOUR;
  protected readonly hotIdle = HOT_IDLE_DAYS;
  protected readonly placeKey = 'observatory.cardPos';
}
