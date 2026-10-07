import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { BehaviorSubject, Subscription } from 'rxjs';
import { ACTIVITY_IDLE_MS, ACTIVITY_WORKING_MS, AgentActivity } from './agent-activity';
import { ActivityState } from './agent-feed.types';
import { SESSION } from './testing/live-agent-fixture';

const URL = '/api/live-agents/feed';
const KEY = { session: SESSION, agentId: 'ab12' };

const said = (text: string) => ({
  type: 'assistant',
  message: { content: [{ type: 'text', text }] },
});
const page = (next: number, words: string[] = [], isRestart = false) => ({
  events: words.map(said),
  next,
  isRestart,
});

describe('AgentActivity', () => {
  let subscription: Subscription | undefined;
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    subscription?.unsubscribe();
    vi.useRealTimers();
    Reflect.deleteProperty(document, 'hidden');
  });

  function follow(everyMs: number) {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const interval = new BehaviorSubject(everyMs);
    const states: ActivityState[] = [];
    subscription = TestBed.inject(AgentActivity)
      .follow(KEY, interval)
      .subscribe((state) => states.push(state));
    TestBed.tick();
    return { http: TestBed.inject(HttpTestingController), interval, states };
  }

  const setHidden = (hidden: boolean) => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: hidden });
    document.dispatchEvent(new Event('visibilitychange'));
    TestBed.tick();
  };

  const isFeed = (request: { url: string }) => request.url === URL;

  const texts = (state: ActivityState | undefined): string[] =>
    state?.status === 'ready'
      ? state.entries.flatMap((entry) => (entry.kind === 'text' ? [entry.text] : []))
      : [];

  it('loads first, then asks from the cursor each read returned', () => {
    const { http, states } = follow(ACTIVITY_WORKING_MS);

    const first = http.expectOne(isFeed);
    expect(first.request.params.get('session')).toBe(SESSION);
    expect(first.request.params.get('agent')).toBe('ab12');
    expect(first.request.params.has('from')).toBe(false);
    first.flush(page(120, ['Reading it.'], true));

    vi.advanceTimersByTime(ACTIVITY_WORKING_MS);
    const second = http.expectOne(isFeed);
    expect(second.request.params.get('from')).toBe('120');
    second.flush(page(180, ['Done.']));

    expect(texts(states.at(-1))).toEqual(['Reading it.', 'Done.']);
  });

  it('asks every 3 s while the agent works and every 15 s once it is quiet or waiting', () => {
    const { http, interval } = follow(ACTIVITY_WORKING_MS);
    http.expectOne(isFeed).flush(page(10, [], true));

    vi.advanceTimersByTime(ACTIVITY_WORKING_MS - 1);
    http.expectNone(isFeed);
    vi.advanceTimersByTime(1);
    http.expectOne(isFeed).flush(page(10));

    interval.next(ACTIVITY_IDLE_MS);
    http.expectOne(isFeed).flush(page(10));
    vi.advanceTimersByTime(ACTIVITY_IDLE_MS - 1);
    http.expectNone(isFeed);
    vi.advanceTimersByTime(1);
    http.expectOne(isFeed).flush(page(10));
  });

  it('stops asking while the page is hidden, and asks at once when it is shown', () => {
    const { http } = follow(ACTIVITY_WORKING_MS);
    http.expectOne(isFeed).flush(page(10, [], true));

    setHidden(true);
    vi.advanceTimersByTime(ACTIVITY_IDLE_MS * 3);
    http.expectNone(isFeed);

    setHidden(false);
    expect(http.expectOne(isFeed).request.params.get('from')).toBe('10');
  });

  it('keeps the rows it has when a later read fails', () => {
    const { http, states } = follow(ACTIVITY_WORKING_MS);
    http.expectOne(isFeed).flush(page(10, ['Kept.'], true));

    vi.advanceTimersByTime(ACTIVITY_WORKING_MS);
    http.expectOne(isFeed).error(new ProgressEvent('error'));

    expect(states.map((state) => state.status)).toEqual(['ready']);
    expect(texts(states.at(-1))).toEqual(['Kept.']);
  });

  it('starts the rows afresh when the server says the feed restarted', () => {
    const { http, states } = follow(ACTIVITY_WORKING_MS);
    http.expectOne(isFeed).flush(page(10, ['Old.'], true));

    vi.advanceTimersByTime(ACTIVITY_WORKING_MS);
    http.expectOne(isFeed).flush(page(5, ['New.'], true));

    expect(texts(states.at(-1))).toEqual(['New.']);
  });

  it('reads a 404 as the hosted site and never asks again', () => {
    const { http, states } = follow(ACTIVITY_WORKING_MS);

    http.expectOne(isFeed).flush({ error: 'not found' }, { status: 404, statusText: 'Not Found' });
    vi.advanceTimersByTime(ACTIVITY_IDLE_MS * 2);

    expect(states).toEqual([{ status: 'local-only' }]);
    http.expectNone(isFeed);
  });
});
