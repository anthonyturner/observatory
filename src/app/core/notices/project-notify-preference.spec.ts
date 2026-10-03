import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { lastValueFrom } from 'rxjs';
import { BROWSER_NOTICES } from '../agent-usage/browser-notices';
import { FakeBrowserNotices } from '../agent-usage/testing/fake-browser-notices';
import { PageVisibility } from '../presence/page-visibility';
import { ProjectNotifyPreference } from './project-notify-preference';

const STORAGE_KEY = 'observatory.project-notify';

function setUp(notices: FakeBrowserNotices) {
  const isHidden = signal(false);
  TestBed.configureTestingModule({
    providers: [
      { provide: BROWSER_NOTICES, useValue: notices },
      { provide: PageVisibility, useValue: { isHidden } },
    ],
  });
  const preference = TestBed.inject(ProjectNotifyPreference);
  TestBed.tick();
  return { preference, isHidden };
}

/** Long enough for a refusal to be written into the emptied status line. */
const AFTER_REWRITE_MS = 1_000;

/** Lets the browser's answer arrive, and the status line be written again. */
const settle = async (): Promise<void> => {
  await vi.advanceTimersByTimeAsync(AFTER_REWRITE_MS);
};

describe('ProjectNotifyPreference', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });
  afterEach(() => vi.useRealTimers());

  it('starts off, and does not ask the browser until turned on', () => {
    const notices = new FakeBrowserNotices('default', 'granted');
    const { preference } = setUp(notices);

    expect(preference.isOn()).toBe(false);
    expect(notices.requests).toBe(0);
  });

  it('asks once when turned on, stays on when allowed, and remembers it', async () => {
    const notices = new FakeBrowserNotices('default', 'granted');
    const { preference } = setUp(notices);

    await lastValueFrom(preference.turnOn());

    expect(notices.requests).toBe(1);
    expect(preference.isOn()).toBe(true);
    expect(preference.isRefused()).toBe(false);
    expect(localStorage.getItem(STORAGE_KEY)).toBe('on');
  });

  it('stays off and says it was refused when the owner says no or the browser has blocked it', async () => {
    for (const permission of ['default', 'denied'] as const) {
      TestBed.resetTestingModule();
      localStorage.clear();
      const notices = new FakeBrowserNotices(permission, 'denied');
      const { preference } = setUp(notices);

      await lastValueFrom(preference.turnOn());
      await settle();

      expect(preference.isOn()).toBe(false);
      expect(preference.isRefused()).toBe(true);
      expect(notices.requests).toBe(permission === 'default' ? 1 : 0);
      expect(localStorage.getItem(STORAGE_KEY)).toBe('off');
    }
  });

  it('clears the refusal once allowed, or turned off', async () => {
    const notices = new FakeBrowserNotices('denied');
    const { preference } = setUp(notices);
    await lastValueFrom(preference.turnOn());
    await settle();
    expect(preference.isRefused()).toBe(true);

    notices.setPermission('granted');
    await lastValueFrom(preference.turnOn());
    expect(preference.isRefused()).toBe(false);
    expect(preference.isOn()).toBe(true);

    preference.turnOff();
    expect(preference.isOn()).toBe(false);
    expect(localStorage.getItem(STORAGE_KEY)).toBe('off');
  });

  it('empties the refusal when asked again, then writes it back, so it is announced again', async () => {
    const { preference } = setUp(new FakeBrowserNotices('denied'));
    await lastValueFrom(preference.turnOn());
    await settle();

    await lastValueFrom(preference.turnOn());
    expect(preference.isRefused()).toBe(false);

    await settle();
    expect(preference.isRefused()).toBe(true);
  });

  it('drops a refusal still to be written once the box is unticked', async () => {
    const { preference } = setUp(new FakeBrowserNotices('denied'));
    await lastValueFrom(preference.turnOn());

    preference.turnOff();
    await settle();

    expect(preference.isRefused()).toBe(false);
  });

  it('keeps the answer when whoever asked has gone before the browser answers', async () => {
    const notices = new FakeBrowserNotices('default', 'granted');
    const { preference } = setUp(notices);

    preference.turnOn().subscribe().unsubscribe();
    await settle();

    expect(preference.isOn()).toBe(true);
    expect(localStorage.getItem(STORAGE_KEY)).toBe('on');
  });

  it('follows the choice made in another tab', () => {
    const { preference } = setUp(new FakeBrowserNotices('granted'));
    const storedElsewhere = (newValue: string | null, key: string | null = STORAGE_KEY) =>
      window.dispatchEvent(new StorageEvent('storage', { key, newValue }));

    storedElsewhere('on');
    expect(preference.isOn()).toBe(true);

    storedElsewhere('off');
    expect(preference.isOn()).toBe(false);

    storedElsewhere('on');
    storedElsewhere('on', 'observatory.motion');
    expect(preference.isOn()).toBe(true);
    storedElsewhere(null, null);
    expect(preference.isOn()).toBe(false);
  });

  it('is on from the start on a later visit, where it was left on and is still allowed', () => {
    localStorage.setItem(STORAGE_KEY, 'on');

    expect(setUp(new FakeBrowserNotices('granted')).preference.isOn()).toBe(true);
  });

  it('shows off once permission is taken back, read again on returning to the tab', () => {
    localStorage.setItem(STORAGE_KEY, 'on');
    const notices = new FakeBrowserNotices('granted');
    const { preference, isHidden } = setUp(notices);
    isHidden.set(true);
    TestBed.tick();

    notices.setPermission('denied');
    isHidden.set(false);
    TestBed.tick();

    expect(preference.isOn()).toBe(false);
  });

  it('knows when the browser has no notifications at all', () => {
    expect(setUp(new FakeBrowserNotices('unsupported')).preference.isSupported).toBe(false);
  });
});
