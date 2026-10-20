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

  it('reads the folder again on demand, asking the API for a fresh read', () => {
    const { feed, http } = watch();
    http.expectOne('/api/logs?repo=me/app').flush(LOG_FIXTURE);

    feed.refresh();
    expect(feed.isWaiting()).toBe(true);
    http.expectOne('/api/logs?repo=me/app&fresh=1').flush({ ...LOG_FIXTURE, source: 'Again' });

    expect(feed.isWaiting()).toBe(false);
    expect(feed.state()).toEqual({
      status: 'ready',
      snapshot: { ...LOG_FIXTURE, source: 'Again' },
    });
  });

  it('keeps the sky it has while a fresh read is on its way', () => {
    const { feed, http } = watch();
    http.expectOne('/api/logs?repo=me/app').flush(LOG_FIXTURE);

    feed.refresh();

    expect(feed.state()).toEqual({ status: 'ready', snapshot: LOG_FIXTURE });
    http.expectOne('/api/logs?repo=me/app&fresh=1');
  });

  it('does nothing on a refresh, clear or reset before it is watching', () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), LogsFeed],
    });
    const feed = TestBed.inject(LogsFeed);

    feed.refresh();
    feed.clearToNow();
    feed.restore();

    expect(feed.isWaiting()).toBe(false);
    TestBed.inject(HttpTestingController).verify();
  });

  it('clears the sky to now, then reads the folder afresh', () => {
    const { feed, http } = watch();
    http.expectOne('/api/logs?repo=me/app').flush(LOG_FIXTURE);

    feed.clearToNow();

    expect(feed.isWaiting()).toBe(true);
    const clear = http.expectOne('/api/logs/clear');
    expect(clear.request.method).toBe('POST');
    expect(clear.request.body).toEqual({ repo: 'me/app' });
    expect(clear.request.headers.get('x-observatory')).toBe('1');
    clear.flush({ clearedAt: '2026-09-26T09:45:00' });
    const cleared = { ...LOG_FIXTURE, clearedAt: '2026-09-26T09:45:00' };
    http.expectOne('/api/logs?repo=me/app&fresh=1').flush(cleared);

    expect(feed.state()).toEqual({ status: 'ready', snapshot: cleared });
    expect(feed.isWaiting()).toBe(false);
  });

  it('resets the clear, then reads the folder afresh', () => {
    const { feed, http } = watch();
    http.expectOne('/api/logs?repo=me/app').flush(LOG_FIXTURE);

    feed.restore();

    const reset = http.expectOne('/api/logs/clear?repo=me/app');
    expect(reset.request.method).toBe('DELETE');
    expect(reset.request.headers.get('x-observatory')).toBe('1');
    reset.flush(null);
    http.expectOne('/api/logs?repo=me/app&fresh=1').flush(LOG_FIXTURE);
    expect(feed.isWaiting()).toBe(false);
  });

  it('says so when a clear does not reach the API, and leaves the sky as it was', () => {
    const { feed, http } = watch();
    http.expectOne('/api/logs?repo=me/app').flush(LOG_FIXTURE);

    feed.clearToNow();
    http.expectOne('/api/logs/clear').flush('no', { status: 403, statusText: 'Forbidden' });

    expect(feed.isRefused()).toBe(true);
    expect(feed.isWaiting()).toBe(false);
    expect(feed.state()).toEqual({ status: 'ready', snapshot: LOG_FIXTURE });
    http.verify();

    feed.clearToNow();
    expect(feed.isRefused()).toBe(false);
    http.expectOne('/api/logs/clear');
  });
});
