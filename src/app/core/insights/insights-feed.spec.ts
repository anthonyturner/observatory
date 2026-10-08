import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { InsightsFeed } from './insights-feed';

const PART = { status: 'read', note: null };
const BODY = {
  generatedAt: '2026-10-08T12:00:00Z',
  repo: 'me/a',
  weeks: 12,
  commits: { ...PART, weeks: [] },
  contributors: { ...PART, people: [] },
  pulls: { ...PART, finished: [] },
  traffic: { ...PART, views: null, clones: null },
};

describe('InsightsFeed', () => {
  function setUp() {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), InsightsFeed],
    });
    return { feed: TestBed.inject(InsightsFeed), http: TestBed.inject(HttpTestingController) };
  }

  it('reads the insights of the repository it is given', () => {
    const { feed, http } = setUp();
    feed.load('me/a');
    expect(feed.state()).toEqual({ status: 'reading' });

    http.expectOne('/api/insights?repo=me/a').flush(BODY);

    expect(feed.state().status).toBe('ready');
  });

  it('asks GitHub again past the cache, keeping the insights on screen meanwhile', () => {
    const { feed, http } = setUp();
    feed.load('me/a');
    http.expectOne('/api/insights?repo=me/a').flush(BODY);

    feed.recount();
    expect(feed.state().status).toBe('ready');
    http.expectOne('/api/insights?repo=me/a&fresh=1').flush('not json at all');

    expect(feed.state().status).toBe('ready');
  });

  it('tells a repository it may not see from one it cannot reach', () => {
    const { feed, http } = setUp();
    feed.load('me/secret');
    http
      .expectOne('/api/insights?repo=me/secret')
      .flush({ error: 'no star map' }, { status: 404, statusText: 'Not Found' });
    expect(feed.state()).toEqual({ status: 'missing' });

    feed.load('me/a');
    http.expectOne('/api/insights?repo=me/a').flush('not json at all');
    expect(feed.state()).toEqual({ status: 'unreachable' });
  });
});
