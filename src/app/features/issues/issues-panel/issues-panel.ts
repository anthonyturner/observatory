import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { IssueBar } from '../issue-bar/issue-bar';
import { OpenPull } from '../issue-list';
import { IssueList } from '../issue-list/issue-list';
import { IssuesScreen } from '../issues-screen';

/** The Issues screen as a list: the bar atop it, then the tab's issues. */
@Component({
  selector: 'app-issues-panel',
  imports: [IssueBar, IssueList],
  templateUrl: './issues-panel.html',
  styleUrl: './issues-panel.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IssuesPanel {
  /** The open pull requests the queue knows, for the chips. */
  readonly pulls = input.required<ReadonlyMap<number, OpenPull>>();
  /** Asks for an open pull request's screen. */
  readonly pull = output<number>();
  /** Asks to read an issue in the issue window. */
  readonly open = output<number>();

  protected readonly screen = inject(IssuesScreen);
}
