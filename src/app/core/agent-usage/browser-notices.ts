import { DOCUMENT, DestroyRef, InjectionToken, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, defer, map, of, shareReplay, tap } from 'rxjs';

/** The browser's notifications, behind a token so a test can stand in for them. */
export interface BrowserNotices {
  /** What the browser allows, or `unsupported` where it has no notifications. */
  permission(): NotificationPermission | 'unsupported';
  /** Asks the owner once; true when granted. */
  request(): Promise<boolean>;
  /** Shows a notification; clicking it brings this tab forward. */
  show(title: string, body: string, tag: string): void;
}

export const BROWSER_NOTICES = new InjectionToken<BrowserNotices>('BrowserNotices', {
  providedIn: 'root',
  factory: () => {
    const view = inject(DOCUMENT).defaultView;
    const Notice = view?.Notification;
    return {
      permission: () => Notice?.permission ?? 'unsupported',
      request: async () => {
        try {
          return Notice ? (await Notice.requestPermission()) === 'granted' : false;
        } catch {
          return false;
        }
      },
      show: (title, body, tag) => {
        if (!Notice) return;
        try {
          const notice = new Notice(title, { body, tag });
          notice.onclick = () => {
            view?.focus();
            notice.close();
          };
        } catch {
          // Chrome for Android allows notifications only from a service worker,
          // which this site has none of: the card on Home still shows.
        }
      },
    };
  },
});

/**
 * Whether the browser will show notifications: true when already allowed, or
 * when the owner allows them now. It asks only while the owner has not chosen,
 * and a browser asks only from a click, so subscribe from one.
 */
export function permissionToNotify(notices: BrowserNotices): Observable<boolean> {
  return defer(() => {
    const permission = notices.permission();
    if (permission === 'granted') return of(true);
    if (permission !== 'default') return of(false);
    return notices.request();
  });
}

/**
 * Asks as `permissionToNotify` does, at once, and hands the answer to `keep`
 * under the owner's lifetime rather than the asker's: the browser's prompt can
 * stay open after the section that raised it has gone. The Observable returned
 * tells the asker when the answer has been kept.
 */
export function askToNotify(
  notices: BrowserNotices,
  keep: (isAllowed: boolean) => void,
  owner: DestroyRef,
): Observable<void> {
  const kept = permissionToNotify(notices).pipe(
    tap(keep),
    map(() => undefined),
    takeUntilDestroyed(owner),
    shareReplay(1),
  );
  kept.subscribe();
  return kept;
}
