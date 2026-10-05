import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { SpokenReplies } from '../voice/spoken-replies';
import { JEV_HOLD_API } from './agent-speech-api';
import { HOLD_RENEW_MS, JevHoldBeacon, NEW_HOLD_TOKEN } from './jev-hold-beacon';

/** A beacon on a line the test starts and ends, with every hold call recorded. */
function setUp() {
  const isBusy = signal(false);
  const calls: string[] = [];
  let made = 0;
  TestBed.configureTestingModule({
    providers: [
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
  const line = (busy: boolean): void => {
    isBusy.set(busy);
    TestBed.tick();
  };
  return { line, calls };
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
});
