import { EnvironmentInjector, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { ActivityWatch } from '../activity/activity-watch';
import { ActivityItem } from '../activity/activity.types';
import { PageVisibility } from '../presence/page-visibility';
import { ViewerSession } from '../session/viewer-session';
import { ANNOUNCEMENT_VOICE } from '../voice/announcement-voice';
import { SpeakPreference } from '../voice/speak-preference';
import { ASK_CHANNEL } from './ask-channel';
import { provideNoticeAnnouncer } from './provide-notice-announcer';

const NEWS: ActivityItem = { kind: 'merged', repo: 'me/a', label: 'a', number: 1, title: 'Fix' };

function setUp() {
  const checks = new Subject<readonly ActivityItem[]>();
  const isConfirmedLocal = signal(false);
  const asked = vi.fn();
  const announce = vi.fn<(text: string) => void>();
  TestBed.configureTestingModule({
    providers: [
      provideNoticeAnnouncer(),
      { provide: ViewerSession, useValue: { isConfirmedLocal } },
      { provide: ActivityWatch, useValue: { checks } },
      { provide: PageVisibility, useValue: { isHidden: signal(false) } },
      { provide: SpeakPreference, useValue: { isOn: signal(true) } },
      {
        provide: ASK_CHANNEL,
        useFactory: () => {
          asked();
          return { submit: () => undefined, busy: signal(false) };
        },
      },
      { provide: ANNOUNCEMENT_VOICE, useValue: { announce, isBusy: signal(false) } },
    ],
  });
  TestBed.inject(EnvironmentInjector);
  TestBed.tick();
  const check = (): void => {
    checks.next([NEWS]);
    TestBed.tick();
  };
  return { isConfirmedLocal, asked, announce, check };
}

describe('provideNoticeAnnouncer', () => {
  it('says nothing, and wakes no assistant, until the session is confirmed local', () => {
    const { asked, announce, check } = setUp();

    check();

    expect(asked).not.toHaveBeenCalled();
    expect(announce).not.toHaveBeenCalled();
  });

  it('says the news once the API confirms this machine', () => {
    const { isConfirmedLocal, announce, check } = setUp();

    isConfirmedLocal.set(true);
    TestBed.tick();
    check();

    expect(announce).toHaveBeenCalledExactlyOnceWith('Pull request 1 in a merged: Fix.');
  });
});
