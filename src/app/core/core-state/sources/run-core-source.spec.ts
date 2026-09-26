import { computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { RunShownState } from '../../runs/run-words';
import { RunsStore } from '../../runs/runs-store';
import { CoreStateStore } from '../core-state-store';
import { RUN_END_HOLD_MS, RunCoreSource } from './run-core-source';

function setUp() {
  const isLive = signal(false);
  const shownState = signal<RunShownState>('starting');
  const followed = signal<{ shownState: () => RunShownState } | null>(null);
  TestBed.configureTestingModule({
    providers: [
      RunCoreSource,
      {
        provide: RunsStore,
        useValue: { isLive, followed: computed(() => followed()) },
      },
    ],
  });
  TestBed.inject(RunCoreSource).connect();
  TestBed.tick();
  const start = () => {
    followed.set({ shownState });
    shownState.set('running');
    isLive.set(true);
    TestBed.tick();
  };
  const end = (state: RunShownState) => {
    shownState.set(state);
    isLive.set(false);
    TestBed.tick();
  };
  return { core: TestBed.inject(CoreStateStore), start, end };
}

describe('RunCoreSource', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('keeps the core on running while a task is live', () => {
    const { core, start } = setUp();

    start();

    expect(core.state()).toBe('running');
    expect(core.chip().id).toBe('working');
  });

  it('shows a task that finished as a tier-3 answer, then rests', () => {
    const { core, start, end } = setUp();
    start();

    end('done');
    expect(core.state()).toBe('answered-3');

    vi.advanceTimersByTime(RUN_END_HOLD_MS);
    expect(core.state()).toBe('idle');
  });

  it('shows an error for a task that failed, errored, hit its limit or was shut down', () => {
    for (const state of ['failed', 'errored', 'time-limit', 'shutdown'] as const) {
      TestBed.resetTestingModule();
      const { core, start, end } = setUp();
      start();

      end(state);

      expect(core.state()).toBe('error');
    }
  });

  it('simply rests after a cancel', () => {
    const { core, start, end } = setUp();
    start();

    end('cancelled');

    expect(core.state()).toBe('idle');
  });

  it('leaves a recording on the core when the task ends under it', () => {
    const { core, start, end } = setUp();
    start();
    core.show('listening');

    end('done');

    expect(core.state()).toBe('listening');
  });
});
