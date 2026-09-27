import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AssistantInfo } from '../assistant/assistant-info';
import { ReplySpeech } from '../assistant/reply-speech';
import { Clock } from '../time/clock';
import { RunAnnouncer } from './run-announcer';
import { RUN_CACHE_STORAGE } from './run-cache';
import { PICKED_UP_FRESH, PICKED_UP_KEPT } from './run-notes';
import { RUNS_API, RunsApiError } from './runs-api';
import { RunsStore } from './runs-store';
import { FakeRunsApi } from './testing/fake-runs-api';
import { STARTED_AT, recordedEvents, summaryOf } from './testing/run-fixtures';

const SECOND = 1000;

function setUp(storage: Storage = sessionStorage) {
  const api = new FakeRunsApi();
  const now = signal(new Date(STARTED_AT + 10 * SECOND));
  const speech = { stop: vi.fn(() => false) };
  TestBed.configureTestingModule({
    providers: [
      { provide: RUNS_API, useValue: api },
      { provide: RUN_CACHE_STORAGE, useValue: storage },
      { provide: Clock, useValue: { now: now.asReadonly() } },
      { provide: ReplySpeech, useValue: speech },
      {
        provide: AssistantInfo,
        useValue: { where: signal('local').asReadonly(), isElsewhere: signal(false).asReadonly() },
      },
    ],
  });
  const store = TestBed.inject(RunsStore);
  const announcer = TestBed.inject(RunAnnouncer);
  return { api, store, now, speech, announcer };
}

const settle = () => vi.advanceTimersByTimeAsync(0);
const events = recordedEvents();

describe('RunsStore', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    sessionStorage.clear();
  });
  afterEach(() => vi.useRealTimers());

  it('follows a run from its first event, and reads its state and transcript as they come', () => {
    const { api, store, speech, announcer } = setUp();

    store.open(summaryOf({ state: 'starting' }));
    const run = store.followed();

    expect(api.follows[0]).toEqual(expect.objectContaining({ id: 'run-1', from: 0 }));
    expect(store.isLive()).toBe(true);
    expect(speech.stop).toHaveBeenCalled();

    api.follows[0].send(events.slice(0, 5));

    expect(run?.state()).toBe('running');
    expect(announcer.said()).toBe('Task running.');
    expect(run?.entries().map((entry) => entry.kind)).toEqual(['fold', 'quiet']);
  });

  it('ends with the run: done, the cost, and the list read again', async () => {
    const { api, store, announcer } = setUp();
    store.open(summaryOf());

    api.follows[0].send(events);
    api.follows[0].end();
    await settle();

    const run = store.followed();
    expect(run?.state()).toBe('done');
    expect(run?.shownState()).toBe('done');
    expect(run?.facts().costUsd).toBe(0.4213);
    expect(store.isLive()).toBe(false);
    expect(announcer.said()).toBe('Task done.');
    expect(api.listCalls).toBe(1);
    expect(api.follows).toHaveLength(1);
  });

  it('says how a cancelled run ended, and where to look', () => {
    const { api, store } = setUp();
    store.open(summaryOf());

    api.follows[0].send([
      {
        n: 0,
        at: STARTED_AT,
        kind: 'state',
        data: { state: 'cancelled', endedAt: STARTED_AT + 30 * SECOND },
      },
    ]);

    expect(store.followed()?.note()).toEqual({
      text: 'Cancelled at 00:30. Anything Claude already changed stays changed; check git status in E:\\repos\\app.',
      isBad: false,
      action: null,
    });
  });

  it('keeps what this tab read for a reload, and picks the run up from there', async () => {
    const first = setUp();
    first.store.open(summaryOf());
    first.api.follows[0].send(events.slice(0, 7));
    window.dispatchEvent(new Event('pagehide'));

    TestBed.resetTestingModule();
    const { api, store } = setUp();
    api.report = { current: summaryOf(), recent: [] };
    await store.pickUp();

    const run = store.followed();
    expect(api.follows[0].from).toBe(7);
    expect(run?.entries().map((entry) => entry.kind)).toEqual(['fold', 'quiet', 'text', 'fold']);
    expect(run?.note()?.text).toBe(PICKED_UP_KEPT);
    expect(sessionStorage.length).toBe(0);
  });

  it('reads the run from the start after a reload with nothing kept', async () => {
    const { api, store } = setUp();
    api.report = { current: summaryOf(), recent: [] };

    await store.pickUp();

    expect(api.follows[0].from).toBe(0);
    expect(store.followed()?.note()?.text).toBe(PICKED_UP_FRESH);
  });

  it('keeps nothing for a reload once the run has ended', () => {
    const { api, store } = setUp();
    store.open(summaryOf());
    api.follows[0].send(events);

    window.dispatchEvent(new Event('pagehide'));

    expect(sessionStorage.length).toBe(0);
  });

  it('shows a run another tab started, quietly', async () => {
    const { api, store } = setUp();
    api.report = { current: summaryOf({ id: 'run-2' }), recent: [] };

    await store.refresh();

    expect(store.followed()?.id).toBe('run-2');
    expect(store.followed()?.note()).toBeNull();
  });

  it('offers Reconnect once the stream is lost, and follows on from there', async () => {
    const { api, store } = setUp();
    store.open(summaryOf());
    api.follows[0].send(events.slice(0, 4));
    for (let drop = 0; drop < 4; drop++) {
      api.follows[drop].end();
      await vi.advanceTimersByTimeAsync(8 * SECOND);
    }
    const run = store.followed();
    expect(run?.state()).toBe('lost');
    expect(run?.note()).toEqual(
      expect.objectContaining({
        text: 'Lost the run’s stream. It may still be running.',
        isBad: true,
      }),
    );

    run?.note()?.action?.press();

    expect(run?.state()).toBe('reconnecting');
    expect(run?.note()).toBeNull();
    expect(api.follows.at(-1)?.from).toBe(4);
  });

  it('takes a run the runner no longer knows as stopped', async () => {
    const { api, store } = setUp();
    store.open(summaryOf());

    api.follows[0].fail(new RunsApiError(404, 'no such run'));
    await settle();

    expect(store.followed()?.state()).toBe('shutdown');
    expect(store.followed()?.note()?.text).toBe(
      'Stopped: the local site shut down during the run.',
    );
  });

  it('cancels the followed run, or says why it could not', async () => {
    const { api, store } = setUp();
    store.open(summaryOf());
    api.cancelAnswer = async () => summaryOf({ state: 'stopping' });

    await store.cancel();

    expect(api.cancelled).toEqual(['run-1']);
    expect(store.followed()?.state()).toBe('stopping');

    api.cancelAnswer = () => Promise.reject(new RunsApiError(404, 'no such run'));
    await store.cancel();
    expect(store.followed()?.note()?.text).toBe('Couldn’t cancel the run: no such run.');
    expect(store.isCancelling()).toBe(false);
  });

  it('says a refused tool aloud while it is news', () => {
    const { api, store, announcer } = setUp();
    store.open(summaryOf());

    api.follows[0].send(events.slice(0, 10));

    expect(announcer.said()).toBe('Not allowed: Bash. 1 refused so far.');
  });

  it('warns as the time limit nears', () => {
    const { store, now, announcer } = setUp();
    store.open(summaryOf());

    now.set(new Date(STARTED_AT + 26 * 60 * SECOND));
    TestBed.tick();
    expect(announcer.said()).toBe('Five minutes left on the task.');

    now.set(new Date(STARTED_AT + 29 * 60 * SECOND + 30 * SECOND));
    TestBed.tick();
    expect(announcer.said()).toBe('One minute left on the task.');
  });

  it('lets a finished run go on close', () => {
    const { api, store } = setUp();
    store.open(summaryOf());
    api.follows[0].send(events);

    store.close();

    expect(store.followed()).toBeNull();
    expect(api.follows[0].signal?.aborted).toBe(true);
  });
});
