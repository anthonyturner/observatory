import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ArchitectureFeed, architectureHtmlUrl } from './architecture-feed';

const MAP = {
  schema: 3,
  project: 'a',
  scannedAt: '2026-10-09T12:00:00.000Z',
  areas: [],
  windows: [],
  nodes: [],
  edges: [],
};

describe('ArchitectureFeed', () => {
  function setUp() {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), ArchitectureFeed],
    });
    return {
      feed: TestBed.inject(ArchitectureFeed),
      http: TestBed.inject(HttpTestingController),
    };
  }

  it('reads the map of the repository it is given', () => {
    const { feed, http } = setUp();
    feed.load('me/a');
    expect(feed.state()).toEqual({ status: 'reading' });

    http.expectOne('/api/architecture?repo=me/a').flush(MAP);

    const state = feed.state();
    expect(state.status).toBe('ready');
    expect(state.status === 'ready' && state.map.project).toBe('a');
  });

  it('tells a repository with no clone here from an API that cannot be reached', () => {
    const { feed, http } = setUp();
    feed.load('me/far');
    http
      .expectOne('/api/architecture?repo=me/far')
      .flush({ error: 'No local clone' }, { status: 404, statusText: 'Not Found' });
    expect(feed.state()).toEqual({ status: 'missing' });

    feed.load('me/a');
    http.expectOne('/api/architecture?repo=me/a').flush('not json at all');
    expect(feed.state()).toEqual({ status: 'unreachable' });
  });

  it('scans the same repository again, past the server memory, when refreshed', () => {
    const { feed, http } = setUp();
    feed.load('me/a');
    http.expectOne('/api/architecture?repo=me/a').flush(MAP);

    feed.refresh();

    expect(feed.state()).toEqual({ status: 'reading' });
    http.expectOne('/api/architecture?repo=me/a&fresh=1').flush(MAP);
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
    const old = http.expectOne('/api/architecture?repo=me/old');
    feed.load('me/a');

    expect(old.cancelled).toBe(true);
    http.expectOne('/api/architecture?repo=me/a').flush(MAP);
    expect(feed.state().status).toBe('ready');
  });
});

describe('architectureHtmlUrl', () => {
  it('names the repository in the query', () => {
    expect(architectureHtmlUrl('me/a')).toBe('/api/architecture/html?repo=me%2Fa');
  });
});
