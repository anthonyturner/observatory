import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ASK_CHANNEL } from '../assistant/ask-channel';
import { SpokenReplies } from '../voice/spoken-replies';
import { TalkState } from '../voice/talk-state';
import { JEV_HOLD_API } from './agent-speech-api';
import { HOLD_RENEW_MS, JevHoldBeacon, NEW_HOLD_TOKEN } from './jev-hold-beacon';

/** A beacon on a mic turn, an ask and a line the test starts and ends, with
 *  every hold call recorded. Each step is seen by the beacon before the next. */
function setUp() {
  const isTalking = signal(false);
  const busy = signal(false);
  const isBusy = signal(false);
  const calls: string[] = [];
  let made = 0;
  TestBed.configureTestingModule({
    providers: [
      { provide: TalkState, useValue: { isTalking } },
      { provide: ASK_CHANNEL, useValue: { submit: () => undefined, busy } },
      { provide: SpokenReplies, useValue: { isBusy } },
      { provide: NEW_HOLD_TOKEN, useValue: () => `line-${++made}` },
      {
        provide: JEV_HOLD_API,
        useValue: {
          renew: (token: string) => {
            calls.push(`renew ${token}`);
            return of(undefined);
          },
          release: (token: string) => {
            calls.push(`release ${token}`);
            return of(undefined);
          },
        },
      },
    ],
  });
  TestBed.inject(JevHoldBeacon);
  TestBed.tick();
  const step =
    (state: typeof isTalking) =>
    (on: boolean): void => {
      state.set(on);
      TestBed.tick();
    };
  return { talk: step(isTalking), ask: step(busy), line: step(isBusy), calls };
}

describe('JevHoldBeacon', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('holds nothing until a line is taken', () => {
    const { calls } = setUp();

    vi.advanceTimersByTime(HOLD_RENEW_MS * 3);

    expect(calls).toEqual([]);
  });

  it('holds from the moment a line is taken, renewing every 2 s, and releases as it ends', () => {
    const { line, calls } = setUp();

    line(true);
    expect(calls).toEqual(['renew line-1']);
    vi.advanceTimersByTime(HOLD_RENEW_MS * 2);
    line(false);
    vi.advanceTimersByTime(HOLD_RENEW_MS * 2);

    expect(calls).toEqual(['renew line-1', 'renew line-1', 'renew line-1', 'release line-1']);
  });

  it('names each line’s hold afresh', () => {
    const { line, calls } = setUp();

    line(true);
    line(false);
    line(true);

    expect(calls).toEqual(['renew line-1', 'release line-1', 'renew line-2']);
  });

  it('releases the hold when the page goes', () => {
    const { line, calls } = setUp();
    line(true);

    TestBed.resetTestingModule();

    expect(calls).toEqual(['renew line-1', 'release line-1']);
  });

  it('holds while the mic is held, just as while a line plays', () => {
    const { talk, calls } = setUp();

    talk(true);
    expect(calls).toEqual(['renew line-1']);
    vi.advanceTimersByTime(HOLD_RENEW_MS * 2);
    talk(false);
    vi.advanceTimersByTime(HOLD_RENEW_MS * 2);

    expect(calls).toEqual(['renew line-1', 'renew line-1', 'renew line-1', 'release line-1']);
  });

  it('keeps one hold from the press, through the ask, to the end of the reply', () => {
    const { talk, ask, line, calls } = setUp();

    talk(true);
    vi.advanceTimersByTime(HOLD_RENEW_MS);
    ask(true);
    talk(false);
    vi.advanceTimersByTime(HOLD_RENEW_MS);
    line(true);
    ask(false);
    vi.advanceTimersByTime(HOLD_RENEW_MS);
    line(false);

    expect(calls).toEqual([
      'renew line-1',
      'renew line-1',
      'renew line-1',
      'renew line-1',
      'release line-1',
    ]);
  });

  it('releases once an ask ends with nothing to read aloud', () => {
    const { talk, ask, calls } = setUp();

    talk(true);
    ask(true);
    talk(false);
    ask(false);
    vi.advanceTimersByTime(HOLD_RENEW_MS * 2);

    expect(calls).toEqual(['renew line-1', 'release line-1']);
  });

  it('holds a typed question while it is asked and while its reply plays', () => {
    const { ask, line, calls } = setUp();

    ask(true);
    line(true);
    ask(false);
    line(false);

    expect(calls).toEqual(['renew line-1', 'release line-1']);
  });

  it('takes a fresh hold for the next question only after a real release', () => {
    const { talk, ask, calls } = setUp();

    talk(true);
    ask(true);
    talk(false);
    ask(false);
    talk(true);

    expect(calls).toEqual(['renew line-1', 'release line-1', 'renew line-2']);
  });
});
