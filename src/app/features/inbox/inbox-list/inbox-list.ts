import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { Router } from '@angular/router';
import { InboxRowView, RepoGroupView } from '../inbox-view';

/**
 * The unread notifications as a list: a section per repository, a heading per
 * reason, and a row per thread with its own Mark read button. A row's beacon
 * pulses while it asks something of you, and holds still when motion is off.
 */
@Component({
  selector: 'app-inbox-list',
  templateUrl: './inbox-list.html',
  styleUrl: './inbox-list.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.still]': 'isStill()' },
})
export class InboxList {
  private readonly router = inject(Router);

  readonly groups = input.required<readonly RepoGroupView[]>();
  /** Threads whose Mark read is on its way to GitHub. */
  readonly marking = input.required<ReadonlySet<string>>();
  readonly isStill = input.required<boolean>();
  /** A thread's id, to mark read. */
  readonly markRead = output<string>();

  /** A plain click on a row that opens inside Observatory stays in the app; any other keeps the browser's own. */
  protected follow(event: MouseEvent, row: InboxRowView): void {
    if (!row.isInside || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey) {
      return;
    }
    event.preventDefault();
    void this.router.navigateByUrl(row.href);
  }
}
