import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { Milestone } from '../../../core/milestones/milestones-report';
import { MilestoneCard } from './milestone-card/milestone-card';
import { milestoneRows } from './milestone-rows';

/** The milestones as a list, for the keyboard and a screen reader: the open ones, then those closed lately. */
@Component({
  selector: 'app-milestone-list',
  imports: [MilestoneCard],
  templateUrl: './milestone-list.html',
  styleUrl: './milestone-list.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MilestoneList {
  /** Soonest due first. */
  readonly open = input.required<readonly Milestone[]>();
  /** Most lately closed first. */
  readonly closed = input.required<readonly Milestone[]>();
  /** When the report was made, which due dates are counted from. */
  readonly now = input.required<number>();
  /** Why GitHub gave none, in place of the list. */
  readonly note = input<string | null>(null);

  protected readonly openRows = computed(() => milestoneRows(this.open(), this.now()));
  protected readonly closedRows = computed(() => milestoneRows(this.closed(), this.now()));
}
