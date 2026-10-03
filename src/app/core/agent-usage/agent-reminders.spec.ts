import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { lastValueFrom, of } from 'rxjs';
import { TrailActivity } from '../sky/trail-activity';
import { Clock } from '../time/clock';
import { REPLY_VOICE } from '../voice/reply-voice';
import { SpeakPreference } from '../voice/speak-preference';
import { AGENT_USAGE_READ, AgentUsageState } from './agent-usage-feed';
import { AgentReminders, REVIEW_WORDS } from './agent-reminders';
import { BROWSER_NOTICES, BrowserNotices } from './browser-notices';
import { runEndingAt } from './testing/agent-run-fixture';

/** Friday 2 October 2026 at 3pm: a Friday review is due. */
const FRIDAY_AFTERNOON = new Date(2026, 9, 2, 15, 0);
const WEDNESDAY = new Date(2026, 8, 30, 12, 0);

const EMPTY: AgentUsageState = {
  status: 'ready',
  document: { generatedAt: '', days: 30, from: '', runs: [] },
};

type Permission = ReturnType<BrowserNotices['permission']>;

interface Options {
  readonly speak?: boolean;
  readonly state?: AgentUsageState;
  readonly permission?: Permission;
  /** What the browser answers when asked. */
  readonly grants?: boolean;
}

function setUp(at: Date, options: Options = {}) {
  const now = signal(at);
  const speak = vi.fn(async () => undefined);
  let permission: Permission = options.permission ?? 'unsupported';
  const notices = {
    permission: () => permission,
    request: vi.fn(async () => {
      permission = options.grants ? 'granted' : 'denied';
      return options.grants ?? false;
    }),
    show: vi.fn(),
  };
  TestBed.configureTestingModule({
    providers: [
      { provide: Clock, useValue: { now } },
      { provide: AGENT_USAGE_READ, useValue: () => of(options.state ?? EMPTY) },
      { provide: TrailActivity, useValue: { ratio: signal(2.5), measured: signal(2.5) } },
      { provide: SpeakPreference, useValue: { isOn: signal(options.speak ?? false) } },
      { provide: REPLY_VOICE, useValue: { speak, stop: () => false, speaking: signal(false) } },
      { provide: BROWSER_NOTICES, useValue: notices },
    ],
  });
  const reminders = TestBed.inject(AgentReminders);
  TestBed.tick();
  return { reminders, now, speak, notices };
}

/** A later visit in the same browser: what was stored is read afresh. */
function again(at: Date, options: Options = {}) {
  TestBed.resetTestingModule();
  return setUp(at, options);
}

const hideTheTab = (hidden: boolean) =>
  Object.defineProperty(document, 'hidden', { value: hidden, configurable: true });

describe('AgentReminders', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => hideTheTab(false));

  it('shows the review on Friday afternoon, not on Wednesday', () => {
    expect(setUp(FRIDAY_AFTERNOON).reminders.due()).toBe('2026-09-28');
    expect(again(WEDNESDAY).reminders.due()).toBeNull();
  });

  it('remembers a review done, across visits', () => {
    setUp(FRIDAY_AFTERNOON).reminders.done();

    expect(again(FRIDAY_AFTERNOON).reminders.due()).toBeNull();
  });

  it('puts a review off until Monday', () => {
    const { reminders, now } = setUp(FRIDAY_AFTERNOON);
    reminders.snooze();
    expect(reminders.due()).toBeNull();

    now.set(new Date(2026, 9, 5, 9, 30));
    expect(reminders.due()).toBe('2026-09-28');
  });

  it('turns every reminder off, the card and the nudges, and remembers it', () => {
    const { reminders } = setUp(FRIDAY_AFTERNOON);
    expect(reminders.nudges().map((nudge) => nudge.kind)).toEqual(['busy-day']);

    reminders.setDay(null);
    expect(reminders.due()).toBeNull();
    expect(reminders.nudges()).toEqual([]);
    expect(again(FRIDAY_AFTERNOON).reminders.settings().day).toBeNull();
  });

  it('rests a dismissed kind for the rest of the day, and brings it back tomorrow', () => {
    const { reminders, now } = setUp(FRIDAY_AFTERNOON);
    reminders.dismiss('busy-day');
    expect(reminders.nudges()).toEqual([]);

    now.set(new Date(2026, 9, 3, 10, 0));
    expect(reminders.nudges().map((nudge) => nudge.kind)).toEqual(['busy-day']);
  });

  it('nudges from the runs themselves', () => {
    const near = ['a', 'b', 'c'].map((id) =>
      runEndingAt(id, 0, 10, {
        agent: 'dev',
        peakContext: 170_000,
        endedAt: FRIDAY_AFTERNOON.toISOString(),
      }),
    );
    const state: AgentUsageState = { status: 'ready', document: { ...EMPTY.document, runs: near } };

    expect(
      setUp(FRIDAY_AFTERNOON, { state })
        .reminders.nudges()
        .map((n) => n.kind),
    ).toContain('near-limit');
  });

  it('ignores stored choices it cannot read', () => {
    localStorage.setItem('observatory.agent-reminders', '{"day":9,"notify":true}');
    localStorage.setItem('observatory.agent-review', '{"done":[3],"snooze":{"week":1}}');

    const { reminders } = setUp(FRIDAY_AFTERNOON);
    expect(reminders.settings()).toEqual({ day: 5, notify: false });
    expect(reminders.due()).toBe('2026-09-28');
  });

  describe('announcing the card', () => {
    it('reads it aloud once when it appears, if Speak is on', () => {
      const { reminders, now, speak } = setUp(FRIDAY_AFTERNOON, { speak: true });
      expect(speak).toHaveBeenCalledExactlyOnceWith(REVIEW_WORDS, 1);

      now.set(new Date(2026, 9, 2, 16, 0));
      TestBed.tick();
      expect(speak).toHaveBeenCalledTimes(1);
      expect(reminders.due()).toBe('2026-09-28');
    });

    it('stays silent when Speak is off', () => {
      expect(setUp(FRIDAY_AFTERNOON).speak).not.toHaveBeenCalled();
    });

    it('announces a review again when it comes back from Monday’s snooze', () => {
      const { reminders, now, speak } = setUp(FRIDAY_AFTERNOON, { speak: true });
      reminders.snooze();

      now.set(new Date(2026, 9, 5, 9, 30));
      TestBed.tick();
      expect(speak).toHaveBeenCalledTimes(2);
    });
  });

  describe('browser notifications', () => {
    it('never asks until Notify me is turned on, then asks once', async () => {
      const { reminders, notices } = setUp(FRIDAY_AFTERNOON, {
        permission: 'default',
        grants: true,
      });
      expect(notices.request).not.toHaveBeenCalled();

      await lastValueFrom(reminders.setNotify(true));
      expect(notices.request).toHaveBeenCalledTimes(1);
      expect(reminders.settings().notify).toBe(true);
    });

    it('keeps the answer when the Agents section has gone before the browser answers', async () => {
      const { reminders } = setUp(FRIDAY_AFTERNOON, { permission: 'default', grants: true });

      reminders.setNotify(true).subscribe().unsubscribe();
      await new Promise((resolve) => setTimeout(resolve));

      expect(reminders.settings().notify).toBe(true);
    });

    it('stays off when the owner refuses, when the browser has refused, or has none', async () => {
      for (const permission of ['default', 'denied', 'unsupported'] as const) {
        const { reminders, notices } = again(FRIDAY_AFTERNOON, { permission, grants: false });
        await lastValueFrom(reminders.setNotify(true));

        expect(reminders.settings().notify).toBe(false);
        expect(notices.request).toHaveBeenCalledTimes(permission === 'default' ? 1 : 0);
      }
    });

    it('shows one notification when the review falls due with Home in the background', () => {
      localStorage.setItem('observatory.agent-reminders', '{"day":5,"notify":true}');
      hideTheTab(true);
      const { notices, now } = setUp(FRIDAY_AFTERNOON, { permission: 'granted' });
      now.set(new Date(2026, 9, 2, 16, 0));
      TestBed.tick();

      expect(notices.show).toHaveBeenCalledExactlyOnceWith(
        'Agent review',
        REVIEW_WORDS,
        'agent-review-2026-09-28',
      );
    });

    it('shows none while Home is in front, where the card says it', () => {
      localStorage.setItem('observatory.agent-reminders', '{"day":5,"notify":true}');

      expect(
        setUp(FRIDAY_AFTERNOON, { permission: 'granted' }).notices.show,
      ).not.toHaveBeenCalled();
    });

    it('shows none where the owner has not asked for them', () => {
      hideTheTab(true);

      expect(
        setUp(FRIDAY_AFTERNOON, { permission: 'granted' }).notices.show,
      ).not.toHaveBeenCalled();
    });
  });
});
