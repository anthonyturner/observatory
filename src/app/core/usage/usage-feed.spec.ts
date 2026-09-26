import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { UsageFeed } from './usage-feed';

const USAGE_URL = '/api/doc?ns=orrery&path=usage/current';

describe('UsageFeed', () => {
  function setUp() {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const feed = TestBed.inject(UsageFeed);
    const http = TestBed.inject(HttpTestingController);
    return { feed, http };
  }

  it('asks the site for the usage document, marked as its own page', () => {
    const { feed, http } = setUp();
    expect(feed.state()).toEqual({ status: 'reading' });

    const request = http.expectOne(USAGE_URL);
    expect(request.request.headers.get('x-starmap')).toBe('1');
    request.flush({ exists: true, data: { generatedAt: '2026-09-26T07:00:00Z' } });

    expect(feed.state()).toEqual({
      status: 'ready',
      document: { generatedAt: '2026-09-26T07:00:00Z', limits: undefined, tokens: undefined },
    });
  });

  it('says missing when the site has no usage document', () => {
    const { feed, http } = setUp();

    http.expectOne(USAGE_URL).flush({ exists: false });

    expect(feed.state()).toEqual({ status: 'missing' });
  });

  it('says unreachable when the site does not answer', () => {
    const { feed, http } = setUp();

    http.expectOne(USAGE_URL).error(new ProgressEvent('error'));

    expect(feed.state()).toEqual({ status: 'unreachable' });
  });
});
