import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';

/** A number shown on one project tab, such as the open alerts on Security. */
export interface TabBadge {
  /** The `id` of the tab it sits on. */
  readonly tabId: string;
  /** What one counted thing is called, for a screen reader: "open alert". */
  readonly noun: string;
  /** The count for `owner/name`; null, or nothing yet, shows no badge. */
  count(repo: string): Observable<number | null>;
}

/** Every badge the strip shows. None unless the app provides them, so a test's strip asks nothing. */
export const TAB_BADGES = new InjectionToken<readonly TabBadge[]>('TAB_BADGES', {
  factory: () => [],
});
