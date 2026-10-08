import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { DeploymentsFeed } from './deployments-feed';
import { PullPreviewFeed } from './pull-preview-feed';
import { RAW_REPORT, rawDeployment } from './testing/deployments-fixture';

const SHA = 'b'.repeat(40);

function setUp() {
  TestBed.configureTestingModule({
    providers: [provideHttpClient(), provideHttpClientTesting(), DeploymentsFeed, PullPreviewFeed],
  });
  return { http: TestBed.inject(HttpTestingController) };
}

describe('DeploymentsFeed', () => {
  it('reads the deployments, then afresh from GitHub when refreshed', () => {
    const { http } = setUp();
    const feed = TestBed.inject(DeploymentsFeed);
    feed.load('me/app');
    expect(feed.state()).toEqual({ status: 'reading' });

    http.expectOne('/api/deployments?repo=me/app').flush(RAW_REPORT);
    expect(feed.state().status).toBe('ready');

    feed.refresh();
    http.expectOne('/api/deployments?repo=me/app&fresh=1').flush(RAW_REPORT);
    expect(feed.state().status).toBe('ready');
  });

  it('keeps the deployments on screen when a later read fails, and says when there is no such project', () => {
    const { http } = setUp();
    const feed = TestBed.inject(DeploymentsFeed);
    feed.load('me/app');
    http.expectOne('/api/deployments?repo=me/app').flush(RAW_REPORT);

    feed.refresh();
    http
      .expectOne('/api/deployments?repo=me/app&fresh=1')
      .flush('down', { status: 502, statusText: 'Bad Gateway' });
    expect(feed.state().status).toBe('ready');

    feed.load('me/gone');
    http
      .expectOne('/api/deployments?repo=me/gone')
      .flush('no', { status: 404, statusText: 'Not Found' });
    expect(feed.state()).toEqual({ status: 'missing' });
  });
});

describe('PullPreviewFeed', () => {
  it('reads what the head was deployed as', () => {
    const { http } = setUp();
    const feed = TestBed.inject(PullPreviewFeed);
    feed.load('me/app', SHA);

    http
      .expectOne(`/api/deployments/preview?repo=me/app&sha=${SHA}`)
      .flush({ repo: 'me/app', sha: SHA, deployments: [rawDeployment(1, 'Preview', 'ready')] });

    expect(feed.deployments().map((each) => each.outcome)).toEqual(['ready']);
  });

  it('shows nothing when the read fails, and asks for nothing without a head', () => {
    const { http } = setUp();
    const feed = TestBed.inject(PullPreviewFeed);
    feed.load('me/app', SHA);
    http
      .expectOne(`/api/deployments/preview?repo=me/app&sha=${SHA}`)
      .flush('down', { status: 502, statusText: 'Bad Gateway' });
    expect(feed.deployments()).toEqual([]);

    feed.load('me/app', '');
    http.expectNone((request) => request.url === '/api/deployments/preview');
  });
});
