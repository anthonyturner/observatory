import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { LogsFeed } from './logs-feed';
import { LOG_FIXTURE } from './testing/log-fixture';

function watch() {
  TestBed.configureTestingModule({
    providers: [provideHttpClient(), provideHttpClientTesting(), LogsFeed],
  });
  const feed = TestBed.inject(LogsFeed);
  feed.watch('me/app');
  return { feed, http: TestBed.inject(HttpTestingController) };
}

describe('LogsFeed', () => {
  it('reads the repository’s snapshot', () => {
    const { feed, http } = watch();
    expect(feed.state()).toEqual({ status: 'reading' });

    http.expectOne('/api/logs?repo=me/app').flush(LOG_FIXTURE);

    expect(feed.state()).toEqual({ status: 'ready', snapshot: LOG_FIXTURE });
  });

  it('says when no folder is recorded', () => {
    const { feed, http } = watch();
    http.expectOne('/api/logs?repo=me/app').flush({ configured: false, reason: 'not-set' });

    expect(feed.state()).toEqual({ status: 'unconfigured', reason: 'not-set' });
  });

  it('says when the API is out of reach', () => {
    const { feed, http } = watch();
    http
      .expectOne('/api/logs?repo=me/app')
      .flush('down', { status: 502, statusText: 'Bad Gateway' });

    expect(feed.state()).toEqual({ status: 'unreachable' });
  });
});
