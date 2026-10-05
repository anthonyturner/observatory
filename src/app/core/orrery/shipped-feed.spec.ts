import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ShippedFeed } from './shipped-feed';

describe('ShippedFeed', () => {
  let feed: ShippedFeed;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ShippedFeed, provideHttpClient(), provideHttpClientTesting()],
    });
    feed = TestBed.inject(ShippedFeed);
    http = TestBed.inject(HttpTestingController);
  });

  it('reads each project’s ledger and keeps what the readable ones shipped', () => {
    feed.load(['o/app', 'o/secret']);
    http.expectOne('/api/ledger?repo=o/app').flush({
      generatedAt: '2026-10-05T12:00:00Z',
      rows: [{ day: '2026-10-04', open: 0, opened: [], merged: [7], closed: [] }],
      titles: { '7': 'Ship it' },
    });
    http
      .expectOne('/api/ledger?repo=o/secret')
      .flush('no', { status: 403, statusText: 'Forbidden' });

    expect(feed.items().map((item) => item.key)).toEqual(['o/app#7']);
  });

  it('does not read the same projects twice in a row', () => {
    feed.load(['o/app']);
    http.expectOne('/api/ledger?repo=o/app').flush({ generatedAt: 'x', rows: [], titles: {} });
    feed.load(['o/app']);
    http.expectNone('/api/ledger?repo=o/app');
  });
});
