import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { PushToTalk } from '../../voice/push-to-talk';
import { ERROR_HOLD_MS } from '../core-holds';
import { CoreStateStore } from '../core-state-store';
import { TalkCoreSource } from './talk-core-source';

function setUp() {
  const talk = { isRecording: signal(false), isWorking: signal(false), isBlocked: signal(false) };
  TestBed.configureTestingModule({
    providers: [TalkCoreSource, { provide: PushToTalk, useValue: talk }],
  });
  TestBed.inject(TalkCoreSource).connect();
  TestBed.tick();
  return { talk, core: TestBed.inject(CoreStateStore) };
}

describe('TalkCoreSource', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('listens while recording, works while transcribing, then rests', () => {
    const { talk, core } = setUp();

    talk.isRecording.set(true);
    TestBed.tick();
    expect(core.state()).toBe('listening');

    talk.isRecording.set(false);
    talk.isWorking.set(true);
    TestBed.tick();
    expect(core.state()).toBe('transcribing');

    talk.isWorking.set(false);
    TestBed.tick();
    expect(core.state()).toBe('idle');
  });

  it('leaves the request its words were sent as on the core', () => {
    const { talk, core } = setUp();
    talk.isWorking.set(true);
    TestBed.tick();

    core.show('routing');
    talk.isWorking.set(false);
    TestBed.tick();

    expect(core.state()).toBe('routing');
  });

  it('rests when a recording is thrown away', () => {
    const { talk, core } = setUp();
    talk.isRecording.set(true);
    TestBed.tick();

    talk.isRecording.set(false);
    TestBed.tick();

    expect(core.state()).toBe('idle');
  });

  it('shows an error when voice is blocked, then rests', () => {
    const { talk, core } = setUp();

    talk.isBlocked.set(true);
    TestBed.tick();
    expect(core.state()).toBe('error');

    vi.advanceTimersByTime(ERROR_HOLD_MS);
    expect(core.state()).toBe('idle');
  });
});
