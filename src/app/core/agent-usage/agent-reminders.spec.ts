import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { TrailActivity } from '../sky/trail-activity';
import { Clock } from '../time/clock';
import { REPLY_VOICE } from '../voice/reply-voice';
import { SpeakPreference } from '../voice/speak-preference';
import { AGENT_USAGE_READ, AgentUsageState } from './agent-usage-feed';
import { AgentReminders, REVIEW_WORDS } from './agent-reminders';
import { runEndingAt } from './testing/agent-run-fixture';

/** Friday 2 October 2026 at 3pm: a Friday review is due. */
const FRIDAY_AFTERNOON = new Date(2026, 9, 2, 15, 0);
const WEDNESDAY = new Date(2026, 8, 30, 12, 0);

const EMPTY: AgentUsageState = {
  status: 'ready',
  document: { generatedAt: '', days: 30, from: '', runs: [] },
};

function setUp(at: Date, options: { speak?: boolean; state?: AgentUsageState } = {}) {
  const now = signal(at);
  const speak = vi.fn(async () => undefined);
  TestBed.configureTestingModule({
    providers: [
      { provide: Clock, useValue: { now } },
      { provide: AGENT_USAGE_READ, useValue: () => of(options.state ?? EMPTY) },
      { provide: TrailActivity, useValue: { measured: signal(2.5), pace: signal(2.5) } },
      { provide: SpeakPreference, useValue: { isOn: signal(options.speak ?? false) } },
      { provide: REPLY_VOICE, useValue: { speak, stop: () => false, speaking: signal(false) } },
    ],
  });
  const reminders = TestBed.inject(AgentReminders);
  TestBed.tick();
  return { reminders, now, speak };
}

describe('AgentReminders', () => {
  beforeEach(() => localStorage.clear());

  it('shows the review on Friday afternoon, not on Wednesday', () => {
    expect(setUp(FRIDAY_AFTERNOON).reminders.due()).toBe('2026-09-28');
    TestBed.resetTestingModule();
    expect(setUp(WEDNESDAY).reminders.due()).toBeNull();
  });

  it('remembers a review done, across visits', () => {
    setUp(FRIDAY_AFTERNOON).reminders.done();
    TestBed.resetTestingModule();

    expect(setUp(FRIDAY_AFTERNOON).reminders.due()).toBeNull();
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
    TestBed.resetTestingModule();
    expect(setUp(FRIDAY_AFTERNOON).reminders.settings().day).toBeNull();
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
    const { reminders } = setUp(FRIDAY_AFTERNOON, { state });

    expect(reminders.nudges().map((nudge) => nudge.kind)).toContain('near-limit');
  });

  it('reads the review aloud once when it appears, if Speak is on', () => {
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

  it('keeps notifications off where the browser cannot give them', async () => {
    const { reminders } = setUp(FRIDAY_AFTERNOON);
    await reminders.setNotify(true);

    expect(reminders.settings().notify).toBe(false);
  });
});
