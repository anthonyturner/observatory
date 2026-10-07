import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActionsFeed } from './actions-feed';
import { CiHealthFeed } from './ci-health-feed';
import { RunJobsFeed } from './run-jobs-feed';

const REPORT = {
  generatedAt: '2026-10-07T11:00:00Z',
  repo: 'me/a',
  workflows: [],
  runs: [],
  flakyChecks: [],
  health: { repo: 'me/a', branch: 'main', state: 'none', failing: [] },
};

function setUp() {
  TestBed.configureTestingModule({
    providers: [provideHttpClient(), provideHttpClientTesting(), ActionsFeed, RunJobsFeed],
  });
  return { http: TestBed.inject(HttpTestingController) };
}

describe('ActionsFeed', () => {
  it('reads the runs, then afresh from GitHub when refreshed', () => {
    const { http } = setUp();
    const feed = TestBed.inject(ActionsFeed);
    feed.load('me/a');
    expect(feed.state()).toEqual({ status: 'reading' });

    http.expectOne('/api/actions?repo=me/a').flush(REPORT);
    expect(feed.state().status).toBe('ready');

    feed.refresh();
    http.expectOne('/api/actions?repo=me/a&fresh=1').flush(REPORT);
    expect(feed.state().status).toBe('ready');
  });

  it('keeps the runs on screen when a later read fails', () => {
    const { http } = setUp();
    const feed = TestBed.inject(ActionsFeed);
    feed.load('me/a');
    http.expectOne('/api/actions?repo=me/a').flush(REPORT);

    feed.refresh();
    http
      .expectOne('/api/actions?repo=me/a&fresh=1')
      .flush('down', { status: 502, statusText: 'Bad Gateway' });

    expect(feed.state().status).toBe('ready');
  });

  it('tells a repository it may not see from one it cannot reach', () => {
    const { http } = setUp();
    const feed = TestBed.inject(ActionsFeed);
    feed.load('me/secret');
    http
      .expectOne('/api/actions?repo=me/secret')
      .flush({ error: 'no star map' }, { status: 404, statusText: 'Not Found' });
    expect(feed.state()).toEqual({ status: 'missing' });

    feed.load('me/a');
    http.expectOne('/api/actions?repo=me/a').flush('not json at all');
    expect(feed.state()).toEqual({ status: 'unreachable' });
  });
});

describe('RunJobsFeed', () => {
  it('reads the picked run’s jobs, and nothing for no run', () => {
    const { http } = setUp();
    const feed = TestBed.inject(RunJobsFeed);
    feed.load('me/a', 18234567890);
    expect(feed.state()).toEqual({ status: 'reading', runId: 18234567890 });

    http
      .expectOne('/api/actions/run?repo=me/a&run=18234567890')
      .flush({ repo: 'me/a', runId: 18234567890, jobs: [] });
    expect(feed.state().status).toBe('ready');

    feed.load('me/a', null);
    expect(feed.state()).toEqual({ status: 'idle' });
  });
});

describe('CiHealthFeed', () => {
  it('reads a project’s health once while a read is on its way', () => {
    const { http } = setUp();
    const feed = TestBed.inject(CiHealthFeed);
    feed.request('me/a');
    feed.request('me/a');

    http
      .expectOne('/api/ci-health?repo=me/a')
      .flush({ repo: 'me/a', branch: 'main', state: 'failing', failing: ['CI'] });

    expect(feed.health().get('me/a')?.state).toBe('failing');
  });
});
