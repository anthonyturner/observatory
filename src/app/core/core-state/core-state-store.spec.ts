import { TestBed } from '@angular/core/testing';
import { ANSWERED_HOLD_MS, ERROR_HOLD_MS } from './core-holds';
import { CoreStateStore } from './core-state-store';

describe('CoreStateStore', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const setUp = () => TestBed.inject(CoreStateStore);

  it('rests on idle, with the Idle chip lit', () => {
    const core = setUp();

    expect(core.state()).toBe('idle');
    expect(core.chip().id).toBe('idle');
  });

  it('shows the last state written, whichever source wrote it', () => {
    const core = setUp();

    core.show('routing');
    core.show('listening');

    expect(core.state()).toBe('listening');
    expect(core.chip().id).toBe('listening');
  });

  it('holds an answer for its time, then rests', () => {
    const core = setUp();

    core.flash('answered-2', ANSWERED_HOLD_MS);
    vi.advanceTimersByTime(ANSWERED_HOLD_MS - 1);
    expect(core.state()).toBe('answered-2');
    expect(core.chip().id).toBe('idle');

    vi.advanceTimersByTime(1);
    expect(core.state()).toBe('idle');
  });

  it('holds an error for its time, then rests', () => {
    const core = setUp();

    core.flash('error', ERROR_HOLD_MS);
    expect(core.chip().id).toBe('error');

    vi.advanceTimersByTime(ERROR_HOLD_MS);
    expect(core.state()).toBe('idle');
  });

  it('does not let a hold end a state shown after it', () => {
    const core = setUp();

    core.flash('error', ERROR_HOLD_MS);
    core.show('listening');
    vi.advanceTimersByTime(ERROR_HOLD_MS);

    expect(core.state()).toBe('listening');
  });

  it('ends a state only while the core still shows it', () => {
    const core = setUp();

    core.show('transcribing');
    core.show('routing');
    core.end('transcribing');
    expect(core.state()).toBe('routing');

    core.end('routing');
    expect(core.state()).toBe('idle');
  });

  it('speaks with the reply’s tier, and ends when the reply does', () => {
    const core = setUp();

    core.speak(3);
    expect(core.state()).toBe('speaking');
    expect(core.spokenTier()).toBe(3);
    expect(core.chip().id).toBe('speaking');

    core.end('speaking');
    expect(core.state()).toBe('idle');
  });

  it('rests on running while a task runs, and lights Working for a reply that lands', () => {
    const core = setUp();

    core.beginRun();
    expect(core.state()).toBe('running');
    expect(core.chip().id).toBe('working');

    core.flash('answered-1', ANSWERED_HOLD_MS);
    expect(core.chip().id).toBe('working');
    vi.advanceTimersByTime(ANSWERED_HOLD_MS);
    expect(core.state()).toBe('running');

    core.show('listening');
    core.end('listening');
    expect(core.state()).toBe('running');
  });

  it('keeps a running task on the core while its reply is heard', () => {
    const core = setUp();
    core.beginRun();

    core.speak(2);

    expect(core.state()).toBe('running');
    expect(core.spokenTier()).toBe(2);
  });

  it('leaves the viewer’s own state alone when a task starts or ends', () => {
    const core = setUp();
    core.show('listening');

    core.beginRun();
    expect(core.state()).toBe('listening');

    core.endRun('answered-3', ERROR_HOLD_MS);
    expect(core.state()).toBe('listening');
  });

  it('shows how a task ended for its hold, or at once with none', () => {
    const core = setUp();
    core.beginRun();

    core.endRun('answered-3', ERROR_HOLD_MS);
    expect(core.state()).toBe('answered-3');
    vi.advanceTimersByTime(ERROR_HOLD_MS);
    expect(core.state()).toBe('idle');

    core.beginRun();
    core.endRun('idle', 0);
    expect(core.state()).toBe('idle');
  });
});
