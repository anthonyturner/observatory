import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { DiscussionThread } from '../../../core/milestones/milestones-report';
import { plural } from '../../../shared/text/plural';
import { discussionGroups } from './discussion-groups';

/** A project's latest discussions, a quiet list by category, each linked to GitHub. */
@Component({
  selector: 'app-discussion-list',
  templateUrl: './discussion-list.html',
  styleUrl: './discussion-list.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DiscussionList {
  /** Most recently active first. */
  readonly threads = input.required<readonly DiscussionThread[]>();
  /** Every discussion the repository has. */
  readonly total = input.required<number>();
  /** When the report was made. */
  readonly now = input.required<number>();
  /** Why there are none to list, in place of the list. */
  readonly note = input<string | null>(null);
  /** The repository's discussions on GitHub. */
  readonly href = input.required<string>();

  protected readonly groups = computed(() => discussionGroups(this.threads(), this.now()));
  protected readonly count = computed(() => {
    const shown = this.threads().length;
    const total = plural(this.total(), 'discussion');
    return shown < this.total() ? `latest ${shown} of ${total}` : total;
  });
}
