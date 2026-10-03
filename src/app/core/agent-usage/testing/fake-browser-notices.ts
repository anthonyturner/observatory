import { BrowserNotices } from '../browser-notices';

type Permission = ReturnType<BrowserNotices['permission']>;

/** A browser's notifications for tests: it answers a request as told and keeps what it showed. */
export class FakeBrowserNotices implements BrowserNotices {
  readonly shown: { title: string; body: string; tag: string }[] = [];
  requests = 0;

  constructor(
    private current: Permission,
    /** What the owner answers when asked. */
    private readonly answer: NotificationPermission = 'denied',
  ) {}

  permission(): Permission {
    return this.current;
  }

  async request(): Promise<boolean> {
    this.requests++;
    this.current = this.answer;
    return this.answer === 'granted';
  }

  show(title: string, body: string, tag: string): void {
    this.shown.push({ title, body, tag });
  }

  /** The owner changes the site's permission in the browser's settings. */
  setPermission(permission: Permission): void {
    this.current = permission;
  }
}
