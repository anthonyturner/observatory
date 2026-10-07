import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { LIVE_AGENTS_REFRESH_MS, LiveAgentsFeed } from './live-agents-feed';
import { liveAgent } from './testing/live-agent-fixture';

const URL = '/api/live-agents';

describe('LiveAgentsFeed', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    Reflect.deleteProperty(document, 'hidden');
  });

  function setUp() {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const feed = TestBed.inject(LiveAgentsFeed);
    TestBed.tick();
    return { feed, http: TestBed.inject(HttpTestingController) };
  }

  const setHidden = (hidden: boolean) => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: hidden });
    document.dispatchEvent(new Event('visibilitychange'));
    TestBed.tick();
  };

  it('reads the running agents now, and again every 15 seconds', () => {
    const { feed, http } = setUp();
    expect(feed.state()).toEqual({ status: 'reading' });

    http.expectOne(URL).flush({ agents: [liveAgent()] });
    expect(feed.agents()).toEqual([liveAgent()]);

    vi.advanceTimersByTime(LIVE_AGENTS_REFRESH_MS);
    http.expectOne(URL).flush({ agents: [] });
    expect(feed.state()).toEqual({ status: 'ready', agents: [] });
  });

  it('stops asking while the page is hidden, and asks at once when it is shown', () => {
    const { http } = setUp();
    http.expectOne(URL).flush({ agents: [] });

    setHidden(true);
    vi.advanceTimersByTime(LIVE_AGENTS_REFRESH_MS * 3);
    http.expectNone(URL);

    setHidden(false);
    http.expectOne(URL).flush({ agents: [] });
  });

  it('reads a 404 as the hosted site, which has no agents, and never asks again', () => {
    const { feed, http } = setUp();

    http.expectOne(URL).flush({ error: 'not found' }, { status: 404, statusText: 'Not Found' });
    vi.advanceTimersByTime(LIVE_AGENTS_REFRESH_MS * 2);

    expect(feed.state()).toEqual({ status: 'local-only' });
    http.expectNone(URL);
  });

  it('says unreachable when the API does not answer, and reads again on retry', () => {
    const { feed, http } = setUp();

    http.expectOne(URL).error(new ProgressEvent('error'));
    expect(feed.state()).toEqual({ status: 'unreachable' });

    feed.retry();
    expect(feed.state()).toEqual({ status: 'reading' });
    http.expectOne(URL).flush({ agents: [] });
    expect(feed.agents()).toEqual([]);
  });
});
