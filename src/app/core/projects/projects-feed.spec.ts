import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ProjectsFeed } from './projects-feed';

describe('ProjectsFeed', () => {
  function setUp() {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    return { feed: TestBed.inject(ProjectsFeed), http: TestBed.inject(HttpTestingController) };
  }

  it('reads the projects report', () => {
    const { feed, http } = setUp();
    expect(feed.state()).toEqual({ status: 'reading' });

    http.expectOne('/api/projects').flush({ generatedAt: '2026-09-26T12:00:00Z', projects: [] });

    expect(feed.state()).toEqual({
      status: 'ready',
      report: { generatedAt: '2026-09-26T12:00:00Z', projects: [] },
    });
  });

  it('says unreachable when the API does not answer', () => {
    const { feed, http } = setUp();

    http.expectOne('/api/projects').error(new ProgressEvent('error'));

    expect(feed.state()).toEqual({ status: 'unreachable' });
  });
});
