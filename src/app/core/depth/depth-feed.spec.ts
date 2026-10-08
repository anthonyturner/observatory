import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { DepthFeed } from './depth-feed';

const REPORT = {
  repo: 'me/a',
  scannedAt: '2026-10-08T12:00:00.000Z',
  modules: [],
  principles: [],
};

describe('DepthFeed', () => {
  function setUp() {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), DepthFeed],
    });
    return { feed: TestBed.inject(DepthFeed), http: TestBed.inject(HttpTestingController) };
  }

  it('reads the modules of the repository it is given', () => {
    const { feed, http } = setUp();
    feed.load('me/a');
    expect(feed.state()).toEqual({ status: 'reading' });

    http.expectOne('/api/depth?repo=me/a').flush(REPORT);

    const state = feed.state();
    expect(state.status).toBe('ready');
    expect(state.status === 'ready' && state.report.repo).toBe('me/a');
  });

  it('tells a repository with no clone here from an API that cannot be reached', () => {
    const { feed, http } = setUp();
    feed.load('me/far');
    http
      .expectOne('/api/depth?repo=me/far')
      .flush({ error: 'No local clone' }, { status: 404, statusText: 'Not Found' });
    expect(feed.state()).toEqual({ status: 'missing' });

    feed.load('me/a');
    http.expectOne('/api/depth?repo=me/a').flush('not json at all');
    expect(feed.state()).toEqual({ status: 'unreachable' });
  });

  it('reads the same repository again, past the server memory, when refreshed', () => {
    const { feed, http } = setUp();
    feed.load('me/a');
    http.expectOne('/api/depth?repo=me/a').flush(REPORT);

    feed.refresh();

    expect(feed.state()).toEqual({ status: 'reading' });
    http.expectOne('/api/depth?repo=me/a&fresh=1').flush(REPORT);
    expect(feed.state().status).toBe('ready');
  });

  it('has nothing to refresh before a repository is loaded', () => {
    const { feed, http } = setUp();

    feed.refresh();

    http.expectNone(() => true);
    expect(feed.state()).toEqual({ status: 'reading' });
  });

  it('drops a read still on its way when another repository is asked for', () => {
    const { feed, http } = setUp();
    feed.load('me/old');
    const old = http.expectOne('/api/depth?repo=me/old');
    feed.load('me/a');

    expect(old.cancelled).toBe(true);
    http.expectOne('/api/depth?repo=me/a').flush(REPORT);
    expect(feed.state().status).toBe('ready');
  });
});
