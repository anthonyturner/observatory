import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { ISSUE_TABS, IssueTab, LabelOption } from '../issue-list';

/**
 * pr-starmap's issue bar: the Open and Closed tabs with their counts, the
 * label menu and the search. It rides over the list, or above the nursery sky.
 */
@Component({
  selector: 'app-issue-bar',
  templateUrl: './issue-bar.html',
  styleUrl: './issue-bar.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IssueBar {
  readonly tab = input.required<IssueTab>();
  /** The tabs' counts, once the issues have been read. */
  readonly counts = input<{ readonly open: string; readonly closed: string } | null>(null);
  readonly labels = input.required<readonly LabelOption[]>();
  readonly label = input.required<string>();
  readonly query = input.required<string>();
  readonly tabChange = output<IssueTab>();
  readonly labelChange = output<string>();
  readonly queryChange = output<string>();

  protected readonly tabs = ISSUE_TABS;

  protected onLabel(event: Event): void {
    if (event.target instanceof HTMLSelectElement) this.labelChange.emit(event.target.value);
  }

  protected onQuery(event: Event): void {
    if (event.target instanceof HTMLInputElement) this.queryChange.emit(event.target.value);
  }
}
