import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { parseRiskGlance, parseRiskSummary, riskViewOf } from './risk-glance';
import { RiskGlanceFeed } from './risk-glance-feed';

const HEAD = 'c'.repeat(40);
const glance = {
  number: 7,
  headSha: HEAD,
  level: 'high',
  reasons: ['auth', 'migrations'],
  summarizes: true,
};

describe('parseRiskGlance', () => {
  it('reads a glance, and refuses one without a level it knows', () => {
    expect(parseRiskGlance(glance)).toEqual(glance);
    expect(parseRiskGlance({ ...glance, level: 'extreme' })).toBeNull();
    expect(parseRiskGlance({ ...glance, headSha: 3 })).toBeNull();
    expect(parseRiskGlance('nope')).toBeNull();
  });

  it('reads no summary as none', () => {
    expect(parseRiskSummary({ headSha: HEAD, summary: '' })).toEqual({
      headSha: HEAD,
      summary: null,
    });
    expect(parseRiskSummary({ summary: 'x' })).toBeNull();
  });
});

describe('riskViewOf', () => {
  it('names the level and what raised it', () => {
    const parsed = parseRiskGlance(glance);
    expect(parsed && riskViewOf(parsed, 'Adds sign-in.')).toEqual({
      level: 'high',
      label: 'High risk',
      reasons: 'auth · migrations',
      summary: 'Adds sign-in.',
    });
  });
});

describe('RiskGlanceFeed', () => {
  function setUp() {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), RiskGlanceFeed],
    });
    return { feed: TestBed.inject(RiskGlanceFeed), http: TestBed.inject(HttpTestingController) };
  }

  it('shows the rules at once, then the summary when it comes', () => {
    const { feed, http } = setUp();
    feed.load('me/a', 7);
    expect(feed.state()).toEqual({ status: 'reading' });

    http.expectOne('/api/risk?repo=me/a&number=7').flush(glance);
    expect(feed.state()).toMatchObject({
      status: 'ready',
      view: { label: 'High risk', summary: null },
    });

    http
      .expectOne('/api/risk/summary?repo=me/a&number=7')
      .flush({ headSha: HEAD, summary: 'Adds sign-in.' });
    expect(feed.state()).toMatchObject({ status: 'ready', view: { summary: 'Adds sign-in.' } });
  });

  it('asks for no summary where the server has no model', () => {
    const { feed, http } = setUp();
    feed.load('me/a', 7);

    http.expectOne('/api/risk?repo=me/a&number=7').flush({ ...glance, summarizes: false });
    http.expectNone('/api/risk/summary?repo=me/a&number=7');
    expect(feed.state()).toMatchObject({ status: 'ready', view: { summary: null } });
  });

  it('keeps the rules when the summary fails, or describes another head', () => {
    const { feed, http } = setUp();
    feed.load('me/a', 7);
    http.expectOne('/api/risk?repo=me/a&number=7').flush(glance);
    http.expectOne('/api/risk/summary?repo=me/a&number=7').error(new ProgressEvent('error'));
    expect(feed.state()).toMatchObject({ status: 'ready', view: { label: 'High risk' } });

    feed.load('me/a', 7);
    http.expectOne('/api/risk?repo=me/a&number=7').flush(glance);
    http
      .expectOne('/api/risk/summary?repo=me/a&number=7')
      .flush({ headSha: 'd'.repeat(40), summary: 'Old.' });
    expect(feed.state()).toMatchObject({ status: 'ready', view: { summary: null } });
  });

  it('says unreachable when the API does not answer', () => {
    const { feed, http } = setUp();
    feed.load('me/a', 7);

    http.expectOne('/api/risk?repo=me/a&number=7').error(new ProgressEvent('error'));
    expect(feed.state()).toEqual({ status: 'unreachable' });
  });
});
