import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { ActivityWatch } from '../activity/activity-watch';
import { ActivityItem } from '../activity/activity.types';
import { MailNews } from '../mail/mail-memory';
import { MailWatch } from '../mail/mail-watch';
import { MailMessage } from '../mail/mail.types';
import { PageVisibility } from '../presence/page-visibility';
import { ANNOUNCEMENT_VOICE } from '../voice/announcement-voice';
import { SpeakPreference } from '../voice/speak-preference';
import { TalkState } from '../voice/talk-state';
import { VoiceChoice } from '../voice/voice-choice';
import { ASK_CHANNEL } from './ask-channel';
import { NoticeAnnouncer } from './notice-announcer';
import { ProposalSlot, commandProposalOf } from './proposal';

const merged = (number: number): ActivityItem => ({
  kind: 'merged',
  repo: 'me/alpha',
  label: 'alpha',
  number,
  title: `Pull ${number}`,
});
const issue = (number: number): ActivityItem => ({
  kind: 'issue',
  repo: 'me/beta',
  label: 'beta',
  number,
  title: `Issue ${number}`,
});

const message = (uid: number): MailMessage => ({
  uid,
  from: 'Apple',
  fromAddress: 'no_reply@apple.example',
  subject: 'Your receipt',
  receivedAt: '2026-10-03T12:10:00.000Z',
  isUnread: true,
});

function setUp(options: { readonly speakOn?: boolean; readonly isKokoro?: boolean } = {}) {
  const checks = new Subject<readonly ActivityItem[]>();
  const mail = new Subject<MailNews>();
  const isOnThisMachine = signal(options.isKokoro ?? false);
  const isHidden = signal(false);
  const isOn = signal(options.speakOn ?? true);
  const asking = signal(false);
  const isBusy = signal(false);
  const announce = vi.fn<(text: string) => void>();
  TestBed.configureTestingModule({
    providers: [
      { provide: ActivityWatch, useValue: { checks } },
      { provide: MailWatch, useValue: { news: mail } },
      { provide: VoiceChoice, useValue: { isOnThisMachine } },
      { provide: PageVisibility, useValue: { isHidden } },
      { provide: SpeakPreference, useValue: { isOn } },
      { provide: ASK_CHANNEL, useValue: { submit: () => undefined, busy: asking } },
      { provide: ANNOUNCEMENT_VOICE, useValue: { announce, isBusy } },
    ],
  });
  TestBed.inject(NoticeAnnouncer);
  TestBed.tick();
  const check = (...items: ActivityItem[]): void => {
    checks.next(items);
    TestBed.tick();
  };
  const read = (news: MailNews): void => {
    mail.next(news);
    TestBed.tick();
  };
  const settle = (): void => TestBed.tick();
  const talk = TestBed.inject(TalkState);
  const slot = TestBed.inject(ProposalSlot);
  return {
    check,
    read,
    settle,
    announce,
    isHidden,
    isOn,
    asking,
    isBusy,
    isOnThisMachine,
    talk,
    slot,
  };
}

const PROPOSAL = commandProposalOf(
  { tier: 3, ask: [], commands: [{ shell: 'bash', command: 'npm test' }] },
  'local',
  1,
);

describe('NoticeAnnouncer', () => {
  it('says a check’s news as one line when Jev is free', () => {
    const { check, announce } = setUp();

    check(merged(12), issue(7));

    expect(announce).toHaveBeenCalledExactlyOnceWith(
      'Pull request 12 in alpha merged: Pull 12. New issue 7 in beta: Issue 7.',
    );
  });

  it('says nothing with Speak off, nor later when it is turned on', () => {
    const { check, settle, announce, isOn } = setUp({ speakOn: false });

    check(merged(1));
    isOn.set(true);
    settle();

    expect(announce).not.toHaveBeenCalled();
  });

  it('says nothing of news that came while the tab was hidden, nor on return', () => {
    const { check, settle, announce, isHidden } = setUp();

    isHidden.set(true);
    settle();
    check(merged(1));
    isHidden.set(false);
    settle();

    expect(announce).not.toHaveBeenCalled();
  });

  it('holds the line while a line is being read, then says it once', () => {
    const { check, settle, announce, isBusy } = setUp();

    isBusy.set(true);
    settle();
    check(merged(1));
    expect(announce).not.toHaveBeenCalled();

    isBusy.set(false);
    settle();
    expect(announce).toHaveBeenCalledExactlyOnceWith('Pull request 1 in alpha merged: Pull 1.');
  });

  it('joins later news to a held line, and says them together', () => {
    const { check, settle, announce, asking } = setUp();

    asking.set(true);
    settle();
    check(merged(1));
    check(issue(2));
    asking.set(false);
    settle();

    expect(announce).toHaveBeenCalledExactlyOnceWith(
      'Pull request 1 in alpha merged: Pull 1. New issue 2 in beta: Issue 2.',
    );
  });

  it('waits while the mic is held', () => {
    const { check, settle, announce, talk } = setUp();

    talk.begin();
    settle();
    check(merged(1));
    expect(announce).not.toHaveBeenCalled();

    talk.end();
    settle();
    expect(announce).toHaveBeenCalledTimes(1);
  });

  it('waits while a task is proposed', () => {
    const { check, settle, announce, slot } = setUp();

    slot.show(PROPOSAL);
    settle();
    check(merged(1));
    expect(announce).not.toHaveBeenCalled();

    slot.dismiss();
    settle();
    expect(announce).toHaveBeenCalledTimes(1);
  });

  it('drops a held line when the tab is hidden or Speak goes off', () => {
    const hidden = setUp();
    hidden.isBusy.set(true);
    hidden.settle();
    hidden.check(merged(1));
    hidden.isHidden.set(true);
    hidden.settle();
    hidden.isBusy.set(false);
    hidden.isHidden.set(false);
    hidden.settle();
    expect(hidden.announce).not.toHaveBeenCalled();

    TestBed.resetTestingModule();
    const off = setUp();
    off.isBusy.set(true);
    off.settle();
    off.check(merged(1));
    off.isOn.set(false);
    off.settle();
    off.isBusy.set(false);
    off.isOn.set(true);
    off.settle();
    expect(off.announce).not.toHaveBeenCalled();
  });

  it('never announces while anything keeps Jev busy', () => {
    const { check, settle, announce, isBusy, asking } = setUp();
    announce.mockImplementation(() => {
      expect(isBusy()).toBe(false);
      expect(asking()).toBe(false);
      isBusy.set(true);
    });

    check(merged(1));
    check(merged(2));
    asking.set(true);
    isBusy.set(false);
    settle();
    check(merged(3));
    asking.set(false);
    settle();

    expect(announce.mock.calls.map(([line]) => line)).toEqual([
      'Pull request 1 in alpha merged: Pull 1.',
      'Pull request 2 in alpha merged: Pull 2. Pull request 3 in alpha merged: Pull 3.',
    ]);
  });

  describe('new mail', () => {
    const one: MailNews = {
      newMail: [{ account: 'icloud', messages: [message(7)] }],
      signInFailed: [],
    };

    it('says only the count while ElevenLabs is the voice, never the sender or subject', () => {
      const { read, announce } = setUp();

      read(one);

      expect(announce).toHaveBeenCalledExactlyOnceWith('1 new email in iCloud.');
    });

    it('names a lone message with Kokoro, the voice that stays in this browser', () => {
      const { read, announce } = setUp({ isKokoro: true });

      read(one);

      expect(announce).toHaveBeenCalledExactlyOnceWith(
        'New email in iCloud from Apple: Your receipt.',
      );
    });

    it('goes by the voice chosen when the line is said, not when the mail came', () => {
      const { read, settle, announce, isBusy, isOnThisMachine } = setUp({ isKokoro: true });

      isBusy.set(true);
      settle();
      read(one);
      isOnThisMachine.set(false);
      isBusy.set(false);
      settle();

      expect(announce).toHaveBeenCalledExactlyOnceWith('1 new email in iCloud.');
    });

    it('says the projects’ news and mail held together as one line, counting each account', () => {
      const { check, read, settle, announce, isBusy } = setUp({ isKokoro: true });

      isBusy.set(true);
      settle();
      read(one);
      check(merged(1));
      read({ newMail: [{ account: 'gmail', messages: [message(3)] }], signInFailed: [] });
      isBusy.set(false);
      settle();

      expect(announce).toHaveBeenCalledExactlyOnceWith(
        'Pull request 1 in alpha merged: Pull 1. 1 new email in iCloud, 1 in Gmail.',
      );
    });

    it('never says a refused sign-in', () => {
      const { read, announce } = setUp({ isKokoro: true });

      read({ newMail: [], signInFailed: ['gmail'] });

      expect(announce).not.toHaveBeenCalled();
    });

    it('says nothing of mail with Speak off or the tab hidden', () => {
      const off = setUp({ speakOn: false });
      off.read(one);
      expect(off.announce).not.toHaveBeenCalled();

      TestBed.resetTestingModule();
      const hidden = setUp();
      hidden.isHidden.set(true);
      hidden.settle();
      hidden.read(one);
      hidden.isHidden.set(false);
      hidden.settle();
      expect(hidden.announce).not.toHaveBeenCalled();
    });
  });
});
