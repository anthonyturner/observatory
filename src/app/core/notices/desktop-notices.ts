import { Injectable, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';
import { ActivityWatch } from '../activity/activity-watch';
import { ACTIVITY_KINDS, ActivityItem } from '../activity/activity.types';
import { BROWSER_NOTICES } from '../agent-usage/browser-notices';
import { PageVisibility } from '../presence/page-visibility';
import { desktopNoticeOf } from './notice-words';
import { ProjectNotifyPreference } from './project-notify-preference';

/**
 * Each check's news as desktop notifications, one per kind, sent only while
 * the tab is hidden and Notify me is on. With the tab in front, the notices
 * on the page say it.
 */
@Injectable({ providedIn: 'root' })
export class DesktopNotices {
  private readonly notices = inject(BROWSER_NOTICES);
  private readonly preference = inject(ProjectNotifyPreference);
  private readonly visibility = inject(PageVisibility);

  constructor() {
    inject(ActivityWatch)
      .checks.pipe(
        filter(() => this.isWanted()),
        takeUntilDestroyed(),
      )
      .subscribe((items) => this.send(items));
  }

  /** The browser's answer is read afresh: it may have been taken back while the tab was hidden. */
  private isWanted(): boolean {
    return (
      this.preference.isOn() &&
      this.visibility.isHidden() &&
      this.notices.permission() === 'granted'
    );
  }

  private send(items: readonly ActivityItem[]): void {
    for (const kind of ACTIVITY_KINDS) {
      const ofKind = items.filter((item) => item.kind === kind);
      if (!ofKind.length) continue;
      const { title, body, tag } = desktopNoticeOf(kind, ofKind);
      this.notices.show(title, body, tag);
    }
  }
}
