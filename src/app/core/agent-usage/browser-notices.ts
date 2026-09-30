import { DOCUMENT, InjectionToken, inject } from '@angular/core';

/** The browser's notifications, behind a token so a test can stand in for them. */
export interface BrowserNotices {
  /** What the browser allows, or `unsupported` where it has no notifications. */
  permission(): NotificationPermission | 'unsupported';
  /** Asks the owner once; true when granted. */
  request(): Promise<boolean>;
  show(title: string, body: string, tag: string): void;
}

export const BROWSER_NOTICES = new InjectionToken<BrowserNotices>('BrowserNotices', {
  providedIn: 'root',
  factory: () => {
    const Notice = inject(DOCUMENT).defaultView?.Notification;
    return {
      permission: () => Notice?.permission ?? 'unsupported',
      request: async () => (Notice ? (await Notice.requestPermission()) === 'granted' : false),
      show: (title, body, tag) => {
        if (!Notice) return;
        try {
          new Notice(title, { body, tag });
        } catch {
          // Chrome for Android allows notifications only from a service worker,
          // which this site has none of: the card on Home still shows.
        }
      },
    };
  },
});
