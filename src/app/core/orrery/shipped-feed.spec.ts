import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ShippedItem } from './shipped';
import { ShippedFeed } from './shipped-feed';

const LEDGER = '/api/ledger?repo=o/app';
const CUT = Date.parse('2026-10-05T12:00:00Z');

/** A ledger cut at `generatedAt` that shows `merged` pull requests as merged on 2026-10-04. */
const ledgerBody = (merged: number[], generatedAt = '2026-10-05T12:00:00Z') => ({
  generatedAt,
  rows: [{ day: '2026-10-04', open: 0, opened: [], merged, closed: [] }],
  titles: Object.fromEntries(merged.map((n) => [String(n), `Ship ${n}`])),
});

describe('ShippedFeed', () => {
  let feed: ShippedFeed;
  let http: HttpTestingController;
  let arrived: ShippedItem[];

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ShippedFeed, provideHttpClient(), provideHttpClientTesting()],
    });
    feed = TestBed.inject(ShippedFeed);
    http = TestBed.inject(HttpTestingController);
    arrived = [];
    feed.arrived$.subscribe((item) => arrived.push(item));
  });

  afterEach(() => http.verify());

  it('reads each project’s ledger and keeps what the readable ones shipped', () => {
    feed.observe(
      [
        { repo: 'o/app', open: 1 },
        { repo: 'o/secret', open: 1 },
      ],
      CUT,
    );
    http.expectOne(LEDGER).flush(ledgerBody([7]));
    http
      .expectOne('/api/ledger?repo=o/secret')
      .flush('no', { status: 403, statusText: 'Forbidden' });

    expect(feed.items().map((item) => item.key)).toEqual(['o/app#7']);
    expect(arrived).toEqual([]);
  });

  it('does not read the same projects twice in a row', () => {
    feed.observe([{ repo: 'o/app', open: 1 }], CUT);
    http.expectOne(LEDGER).flush(ledgerBody([]));
    feed.observe([{ repo: 'o/app', open: 1 }], CUT + 1);
    http.expectNone(LEDGER);
  });

  describe('when a project’s open count falls', () => {
    beforeEach(() => {
      feed.observe([{ repo: 'o/app', open: 3 }], CUT);
      http.expectOne(LEDGER).flush(ledgerBody([7]));
    });

    it('reads its ledger again and announces the merge that is new, once', () => {
      feed.observe([{ repo: 'o/app', open: 2 }], CUT + 60_000);
      http.expectOne(LEDGER).flush(ledgerBody([7, 8], '2026-10-05T12:01:30Z'));

      expect(arrived.map((item) => item.key)).toEqual(['o/app#8']);
      expect(
        feed
          .items()
          .map((item) => item.key)
          .sort(),
      ).toEqual(['o/app#7', 'o/app#8']);

      feed.observe([{ repo: 'o/app', open: 2 }], CUT + 120_000);
      http.expectNone(LEDGER);
      expect(arrived).toHaveLength(1);
    });

    it('announces nothing for a pull request that closed without merging, and stops asking', () => {
      feed.observe([{ repo: 'o/app', open: 2 }], CUT + 60_000);
      http.expectOne(LEDGER).flush(ledgerBody([7], '2026-10-05T12:01:30Z'));
      expect(arrived).toEqual([]);

      feed.observe([{ repo: 'o/app', open: 2 }], CUT + 120_000);
      http.expectNone(LEDGER);
    });

    it('keeps asking at each reading while the ledger it gets was cut before the drop', () => {
      feed.observe([{ repo: 'o/app', open: 2 }], CUT + 60_000);
      http.expectOne(LEDGER).flush(ledgerBody([7], '2026-10-05T12:00:30Z'));
      expect(arrived).toEqual([]);

      feed.observe([{ repo: 'o/app', open: 2 }], CUT + 360_000);
      http.expectOne(LEDGER).flush(ledgerBody([7, 8], '2026-10-05T12:06:30Z'));

      expect(arrived.map((item) => item.key)).toEqual(['o/app#8']);
      feed.observe([{ repo: 'o/app', open: 2 }], CUT + 420_000);
      http.expectNone(LEDGER);
    });

    it('does not read a ledger twice at once, and tries again when a read fails', () => {
      feed.observe([{ repo: 'o/app', open: 2 }], CUT + 60_000);
      const pending = http.expectOne(LEDGER);
      feed.observe([{ repo: 'o/app', open: 2 }], CUT + 61_000);
      http.expectNone(LEDGER);
      pending.flush('no', { status: 500, statusText: 'Server Error' });

      feed.observe([{ repo: 'o/app', open: 2 }], CUT + 120_000);
      http.expectOne(LEDGER).flush(ledgerBody([7, 8], '2026-10-05T12:02:30Z'));
      expect(arrived.map((item) => item.key)).toEqual(['o/app#8']);
    });
  });
});
