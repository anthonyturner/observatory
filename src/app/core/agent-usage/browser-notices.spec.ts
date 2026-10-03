import { DestroyRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { lastValueFrom } from 'rxjs';
import { BROWSER_NOTICES, askToNotify, permissionToNotify } from './browser-notices';
import { FakeBrowserNotices } from './testing/fake-browser-notices';

/** The browser's Notification, keeping each one made so a test can click it. */
class ClickableNotice {
  static readonly permission = 'granted';
  static made: ClickableNotice[] = [];
  onclick: (() => void) | null = null;
  readonly close = vi.fn();

  constructor(
    readonly title: string,
    readonly options: NotificationOptions,
  ) {
    ClickableNotice.made.push(this);
  }
}

describe('BROWSER_NOTICES', () => {
  const view = document.defaultView ?? window;
  let original: PropertyDescriptor | undefined;

  beforeEach(() => {
    ClickableNotice.made = [];
    original = Object.getOwnPropertyDescriptor(view, 'Notification');
    Object.defineProperty(view, 'Notification', { configurable: true, value: ClickableNotice });
  });
  afterEach(() => {
    vi.restoreAllMocks();
    if (original) Object.defineProperty(view, 'Notification', original);
    else Reflect.deleteProperty(view, 'Notification');
  });

  it('shows the title, body and tag it is given', () => {
    TestBed.inject(BROWSER_NOTICES).show('New issue', 'me/beta #7 · Issue 7', 'issue-7');

    const [notice] = ClickableNotice.made;
    expect(notice.title).toBe('New issue');
    expect(notice.options).toEqual({ body: 'me/beta #7 · Issue 7', tag: 'issue-7' });
  });

  it('brings the tab forward and closes the notification when it is clicked', () => {
    const focus = vi.spyOn(view, 'focus').mockImplementation(() => undefined);
    TestBed.inject(BROWSER_NOTICES).show('New issue', 'me/beta #7 · Issue 7', 'issue-7');

    ClickableNotice.made[0].onclick?.();

    expect(focus).toHaveBeenCalledOnce();
    expect(ClickableNotice.made[0].close).toHaveBeenCalledOnce();
  });
});

describe('permissionToNotify', () => {
  it('is allowed without asking where the browser already allows it', async () => {
    const notices = new FakeBrowserNotices('granted');

    expect(await lastValueFrom(permissionToNotify(notices))).toBe(true);
    expect(notices.requests).toBe(0);
  });

  it('asks only when subscribed, and only while the owner has not chosen', async () => {
    const notices = new FakeBrowserNotices('default', 'granted');
    const asking = permissionToNotify(notices);
    expect(notices.requests).toBe(0);

    expect(await lastValueFrom(asking)).toBe(true);
    expect(notices.requests).toBe(1);
  });

  it('reads the permission when subscribed, not when made', async () => {
    const notices = new FakeBrowserNotices('denied');
    const asking = permissionToNotify(notices);
    notices.setPermission('granted');

    expect(await lastValueFrom(asking)).toBe(true);
  });

  it('is refused without asking where the browser blocks it or has none', async () => {
    for (const permission of ['denied', 'unsupported'] as const) {
      const notices = new FakeBrowserNotices(permission, 'granted');

      expect(await lastValueFrom(permissionToNotify(notices))).toBe(false);
      expect(notices.requests).toBe(0);
    }
  });
});

describe('askToNotify', () => {
  it('asks at once and keeps the answer though the asker has stopped listening', async () => {
    const notices = new FakeBrowserNotices('default', 'granted');
    const kept: boolean[] = [];

    askToNotify(notices, (isAllowed) => kept.push(isAllowed), TestBed.inject(DestroyRef))
      .subscribe()
      .unsubscribe();
    expect(notices.requests).toBe(1);
    await new Promise((resolve) => setTimeout(resolve));

    expect(kept).toEqual([true]);
  });

  it('tells a later listener the answer was kept', async () => {
    const notices = new FakeBrowserNotices('denied');
    const kept: boolean[] = [];
    const answered = askToNotify(
      notices,
      (isAllowed) => kept.push(isAllowed),
      TestBed.inject(DestroyRef),
    );

    await lastValueFrom(answered);

    expect(kept).toEqual([false]);
  });
});
