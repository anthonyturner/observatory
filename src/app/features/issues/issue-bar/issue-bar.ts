import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ISSUE_TABS } from '../issue-list';
import { IssuesScreen } from '../issues-screen';

/**
 * pr-starmap's issue bar: the Open and Closed tabs with their counts, the
 * label menu and the search. It sits atop the list, or docks above the
 * nursery and filters it, and either way drives the one Issues screen, so a
 * half-typed search survives the switch.
 */
@Component({
  selector: 'app-issue-bar',
  templateUrl: './issue-bar.html',
  styleUrl: './issue-bar.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IssueBar {
  protected readonly screen = inject(IssuesScreen);
  protected readonly tabs = ISSUE_TABS;

  protected onLabel(event: Event): void {
    if (event.target instanceof HTMLSelectElement) this.screen.label.set(event.target.value);
  }

  protected onQuery(event: Event): void {
    if (event.target instanceof HTMLInputElement) this.screen.query.set(event.target.value);
  }
}
