import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { formatDay } from '../../../core/logs/log-format';
import { Draggable } from '../../../shared/draggable/draggable';
import { OpenPull, labelChips, pullChips } from '../issue-list';
import { IssueStar, issueFacts, lookColour, lookWords } from '../issue-look';
import { IssueMeta } from '../issue-meta/issue-meta';

/** Where the card is left, per viewer: the same place as a pull request's card. */
const CARD_PLACE_KEY = 'observatory.cardPos';

/**
 * pr-starmap's card for an issue picked in the nursery: what its body is, its
 * number and title, how idle and old it is, its labels, assignees and pull
 * requests, then Open, which reads it in the issue window, and GitHub.
 */
@Component({
  selector: 'app-issue-card',
  imports: [Draggable, IssueMeta],
  templateUrl: './issue-card.html',
  styleUrls: ['../../starmap/star-card/star-card.css', './issue-card.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IssueCard {
  readonly star = input.required<IssueStar>();
  readonly pulls = input.required<ReadonlyMap<number, OpenPull>>();
  /** The clock to the minute. */
  readonly now = input.required<number>();
  readonly closed = output<void>();
  /** Asks to read the issue in the issue window. */
  readonly open = output<number>();
  /** Asks for an open pull request's screen. */
  readonly pull = output<number>();

  protected readonly placeKey = CARD_PLACE_KEY;
  protected readonly words = computed(() => lookWords(this.star()));
  protected readonly colour = computed(() => lookColour(this.star()));
  protected readonly facts = computed(() =>
    issueFacts(this.star(), this.now(), (iso) => formatDay(iso)),
  );
  protected readonly labels = computed(() => labelChips(this.star().issue));
  protected readonly chips = computed(() => {
    const { issue } = this.star();
    return pullChips(issue.prs, issue.url, this.pulls());
  });
}
