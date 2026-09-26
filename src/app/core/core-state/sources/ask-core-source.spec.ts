import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { AskFeed } from '../../assistant/ask-feed';
import { AskOutcome } from '../../assistant/ask-outcome';
import { ANSWERED_HOLD_MS, ERROR_HOLD_MS } from '../core-holds';
import { CoreStateStore } from '../core-state-store';
import { AskCoreSource } from './ask-core-source';

function setUp() {
  const busy = signal(false);
  const outcomes = new Subject<AskOutcome>();
  TestBed.configureTestingModule({
    providers: [AskCoreSource, { provide: AskFeed, useValue: { busy, outcomes } }],
  });
  TestBed.inject(AskCoreSource).connect();
  TestBed.tick();
  return { busy, outcomes, core: TestBed.inject(CoreStateStore) };
}

describe('AskCoreSource', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('works while a request is out, then holds the tier it was answered at', () => {
    const { busy, outcomes, core } = setUp();

    busy.set(true);
    TestBed.tick();
    expect(core.state()).toBe('routing');

    outcomes.next({ kind: 'answered', tier: 2 });
    busy.set(false);
    TestBed.tick();
    expect(core.state()).toBe('answered-2');

    vi.advanceTimersByTime(ANSWERED_HOLD_MS);
    expect(core.state()).toBe('idle');
  });

  it('shows an error for a failure, then rests', () => {
    const { outcomes, core } = setUp();

    outcomes.next({ kind: 'failed' });
    expect(core.state()).toBe('error');

    vi.advanceTimersByTime(ERROR_HOLD_MS);
    expect(core.state()).toBe('idle');
  });

  it('rests at once when the router was unsure', () => {
    const { busy, outcomes, core } = setUp();
    busy.set(true);
    TestBed.tick();

    outcomes.next({ kind: 'unsure' });

    expect(core.state()).toBe('idle');
  });
});
