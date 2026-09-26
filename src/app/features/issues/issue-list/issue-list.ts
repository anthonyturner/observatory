import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { IssuesReport } from '../../../core/issues/issues-report';
import { IssueMeta } from '../issue-meta/issue-meta';
import { IssueNarrowing, IssueTab, OpenPull, issueSection, isPlainClick } from '../issue-list';
import { IssuesMessage } from '../issues-screen';

/**
 * pr-starmap's issue list: one section for the tab, a row per issue with its
 * labels, assignees and pull-request chips. A title reads the issue here and
 * stays a link, so Ctrl-click still reaches GitHub.
 */
@Component({
  selector: 'app-issue-list',
  imports: [IssueMeta],
  templateUrl: './issue-list.html',
  styleUrls: ['../../starmap/starmap-pr-list/starmap-pr-list.css', './issue-list.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IssueList {
  readonly report = input.required<IssuesReport | null>();
  readonly tab = input.required<IssueTab>();
  readonly narrowing = input.required<IssueNarrowing>();
  readonly pulls = input.required<ReadonlyMap<number, OpenPull>>();
  /** The clock to the minute, for how long each issue has been open. */
  readonly now = input.required<number>();
  /** What to say while there is no report. */
  readonly message = input<IssuesMessage | null>(null);
  /** The issue open in the issue window, whose row reads as current. */
  readonly current = input<number | null>(null);
  /** Asks for an open pull request's screen. */
  readonly pull = output<number>();
  /** Asks to read an issue in the issue window. */
  readonly open = output<number>();

  protected readonly section = computed(() => {
    const report = this.report();
    return report
      ? issueSection({
          tab: this.tab(),
          report,
          narrowing: this.narrowing(),
          pulls: this.pulls(),
          now: this.now(),
        })
      : null;
  });

  /** A plain left click stays on the page; any other opens the link as usual. */
  protected onTitle(event: MouseEvent, number: number): void {
    if (!isPlainClick(event)) return;
    event.preventDefault();
    this.open.emit(number);
  }
}
