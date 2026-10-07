import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { LibraryFeed } from './library-feed';

const REPORT = {
  generatedAt: '2026-10-07T00:00:00Z',
  repo: 'me/a',
  source: 'none',
  url: 'https://github.com/me/a',
  pages: [],
  isTruncated: false,
};

describe('LibraryFeed', () => {
  function setUp() {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), LibraryFeed],
    });
    return { feed: TestBed.inject(LibraryFeed), http: TestBed.inject(HttpTestingController) };
  }

  it('reads the library of the repository it is given', () => {
    const { feed, http } = setUp();
    feed.load('me/a');
    expect(feed.state()).toEqual({ status: 'reading' });

    http.expectOne('/api/library?repo=me/a').flush(REPORT);

    const state = feed.state();
    expect(state.status === 'ready' && state.report.repo).toBe('me/a');
  });

  it('tells a repository it may not see from one it cannot reach', () => {
    const { feed, http } = setUp();
    feed.load('me/secret');
    http
      .expectOne('/api/library?repo=me/secret')
      .flush({ error: 'no star map' }, { status: 404, statusText: 'Not Found' });
    expect(feed.state()).toEqual({ status: 'missing' });

    feed.load('me/a');
    http.expectOne('/api/library?repo=me/a').flush('not json at all');
    expect(feed.state()).toEqual({ status: 'unreachable' });
  });

  it('drops a read still on its way when another repository is asked for', () => {
    const { feed, http } = setUp();
    feed.load('me/old');
    const old = http.expectOne('/api/library?repo=me/old');
    feed.load('me/a');

    expect(old.cancelled).toBe(true);
    http.expectOne('/api/library?repo=me/a').flush(REPORT);
    expect(feed.state().status).toBe('ready');
  });
});
