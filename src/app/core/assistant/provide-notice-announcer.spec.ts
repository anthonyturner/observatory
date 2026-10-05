import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { EnvironmentInjector, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { ActivityWatch } from '../activity/activity-watch';
import { ActivityItem } from '../activity/activity.types';
import { MailWatch } from '../mail/mail-watch';
import { PageVisibility } from '../presence/page-visibility';
import { PAGE_LOCATION, ViewerSession } from '../session/viewer-session';
import { ANNOUNCEMENT_VOICE } from '../voice/announcement-voice';
import { SpeakPreference } from '../voice/speak-preference';
import { ASK_CHANNEL } from './ask-channel';
import { provideNoticeAnnouncer } from './provide-notice-announcer';

const NEWS: ActivityItem = { kind: 'merged', repo: 'me/a', label: 'a', number: 1, title: 'Fix' };

/** The real session, which the test answers as the API would. */
function setUp() {
  const checks = new Subject<readonly ActivityItem[]>();
  const asked = vi.fn();
  const announce = vi.fn<(text: string) => void>();
  TestBed.configureTestingModule({
    providers: [
      provideNoticeAnnouncer(),
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: PAGE_LOCATION, useValue: { here: () => '/', assign: () => undefined } },
      { provide: ActivityWatch, useValue: { checks } },
      { provide: MailWatch, useValue: { news: new Subject() } },
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
  return { asked, announce, check };
}

const answerSession = (body: object): void => {
  TestBed.inject(HttpTestingController).expectOne('/api/session').flush(body);
  TestBed.tick();
};

describe('provideNoticeAnnouncer', () => {
  it('says nothing, and wakes no assistant, before the API has answered', () => {
    const { asked, announce, check } = setUp();

    check();

    expect(TestBed.inject(ViewerSession).access()).toBe('local');
    expect(asked).not.toHaveBeenCalled();
    expect(announce).not.toHaveBeenCalled();
  });

  it('says nothing on the hosted site, even to the signed-in owner', () => {
    const { asked, announce, check } = setUp();

    answerSession({ access: 'owner', signIn: '/api/auth/login' });
    check();

    TestBed.inject(HttpTestingController).expectNone('/api/agent-speech');
    expect(asked).not.toHaveBeenCalled();
    expect(announce).not.toHaveBeenCalled();
  });

  it('says the news once the API confirms this machine, and Agent Speak is quiet', () => {
    const { announce, check } = setUp();

    answerSession({ access: 'local', signIn: null });
    check();
    TestBed.inject(HttpTestingController)
      .expectOne('/api/agent-speech')
      .flush({ busy: false, speaking: false, paused: false, queued: false });
    TestBed.tick();

    expect(announce).toHaveBeenCalledExactlyOnceWith('Pull request 1 in a merged: Fix.');
  });
});
