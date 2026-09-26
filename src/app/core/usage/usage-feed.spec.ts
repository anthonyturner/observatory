import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { UsageFeed } from './usage-feed';

const USAGE_URL = '/api/usage';

describe('UsageFeed', () => {
  function setUp() {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const feed = TestBed.inject(UsageFeed);
    const http = TestBed.inject(HttpTestingController);
    return { feed, http };
  }

  it('asks the API for the usage report', () => {
    const { feed, http } = setUp();
    expect(feed.state()).toEqual({ status: 'reading' });

    http.expectOne(USAGE_URL).flush({ generatedAt: '2026-09-26T07:00:00Z' });

    expect(feed.state()).toEqual({
      status: 'ready',
      document: { generatedAt: '2026-09-26T07:00:00Z', limits: undefined, tokens: undefined },
    });
  });

  it('says missing when the answer is not a usage report', () => {
    const { feed, http } = setUp();

    http.expectOne(USAGE_URL).flush({ error: 'not found' });

    expect(feed.state()).toEqual({ status: 'missing' });
  });

  it('says unreachable when the API does not answer', () => {
    const { feed, http } = setUp();

    http.expectOne(USAGE_URL).error(new ProgressEvent('error'));

    expect(feed.state()).toEqual({ status: 'unreachable' });
  });
});
