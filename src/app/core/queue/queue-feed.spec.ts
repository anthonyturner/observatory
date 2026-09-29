import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { QueueFeed } from './queue-feed';

describe('QueueFeed', () => {
  function setUp() {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), QueueFeed],
    });
    return { feed: TestBed.inject(QueueFeed), http: TestBed.inject(HttpTestingController) };
  }

  it('reads the queue of the repository it watches', () => {
    const { feed, http } = setUp();
    feed.watch('me/a');
    expect(feed.state()).toEqual({ status: 'reading' });

    http.expectOne('/api/queue?repo=me/a').flush({ generatedAt: 'x', repo: 'me/a', items: [] });

    expect(feed.state()).toEqual({
      status: 'ready',
      report: { generatedAt: 'x', repo: 'me/a', items: [] },
    });
  });

  it('says why when the API refuses the repository', () => {
    const { feed, http } = setUp();
    feed.watch('bad');

    http
      .expectOne('/api/queue?repo=bad')
      .flush(
        { error: 'repo must be a GitHub owner/name' },
        { status: 400, statusText: 'Bad Request' },
      );

    expect(feed.state()).toEqual({ status: 'refused', reason: 'repo must be a GitHub owner/name' });
  });

  it('says unreachable when the API does not answer', () => {
    const { feed, http } = setUp();
    feed.watch('me/a');

    http.expectOne('/api/queue?repo=me/a').error(new ProgressEvent('error'));

    expect(feed.state()).toEqual({ status: 'unreachable' });
  });

  it('asks for a fresh read only when Refresh does', () => {
    const { http, feed } = setUp();

    feed.refresh('me/a');
    http.expectOne('/api/queue?repo=me/a').flush({ generatedAt: 'x', repo: 'me/a', items: [] });
    feed.refresh('me/a', true);
    http
      .expectOne('/api/queue?repo=me/a&fresh=1')
      .flush({ generatedAt: 'y', repo: 'me/a', items: [] });
  });
});
