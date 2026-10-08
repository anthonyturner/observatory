import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { SecurityFeed } from './security-feed';
import { openAlertCount, parseSecurityReport, worstSeverity } from './security-report';
import { SecurityTabBadge } from './security-tab-badge';

const BODY = {
  generatedAt: '2026-10-07T11:00:00Z',
  repo: 'me/app',
  sources: [
    {
      kind: 'dependabot',
      status: 'read',
      note: null,
      counts: { critical: 0, high: 2, medium: 1, low: 0 },
    },
    { kind: 'code-scanning', status: 'off', note: 'Code scanning is not set up.', counts: {} },
    { kind: 'nonsense', status: 'read', counts: {} },
  ],
  alerts: [
    {
      kind: 'dependabot',
      number: 8,
      severity: 'high',
      title: 'Prototype pollution',
      where: 'lodash (npm)',
      createdAt: '2026-10-01T10:00:00Z',
      url: 'https://github.com/me/app/security/dependabot/8',
    },
    {
      kind: 'dependabot',
      number: 9,
      severity: 'high',
      title: 'Elsewhere',
      createdAt: '2026-10-01T10:00:00Z',
      url: 'https://evil.example/9',
    },
  ],
  isWithheld: false,
};

describe('parseSecurityReport', () => {
  it('keeps each list and alert it can check, and drops a link off GitHub', () => {
    const report = parseSecurityReport(BODY);

    expect(report?.sources.map((source) => [source.kind, source.status])).toEqual([
      ['dependabot', 'read'],
      ['code-scanning', 'off'],
    ]);
    expect(report?.sources[1].counts).toEqual({ critical: 0, high: 0, medium: 0, low: 0 });
    expect(report?.alerts.map((alert) => alert.number)).toEqual([8]);
    expect(report && openAlertCount(report)).toBe(3);
    expect(report && worstSeverity(report)).toBe('high');
  });

  it('reads anything but a report as none', () => {
    expect(parseSecurityReport({ repo: 'me/app' })).toBeNull();
    expect(parseSecurityReport('down')).toBeNull();
  });
});

function setUp() {
  TestBed.configureTestingModule({
    providers: [provideHttpClient(), provideHttpClientTesting(), SecurityFeed],
  });
  return { http: TestBed.inject(HttpTestingController) };
}

describe('SecurityFeed', () => {
  it('reads the alerts, and tells a project it may not see from one it cannot reach', () => {
    const { http } = setUp();
    const feed = TestBed.inject(SecurityFeed);
    feed.load('me/app');
    expect(feed.state()).toEqual({ status: 'reading' });
    http.expectOne('/api/security?repo=me/app').flush(BODY);
    expect(feed.state().status).toBe('ready');

    feed.load('me/secret');
    http
      .expectOne('/api/security?repo=me/secret')
      .flush({ error: 'no star map' }, { status: 404, statusText: 'Not Found' });
    expect(feed.state()).toEqual({ status: 'missing' });
  });
});

describe('SecurityTabBadge', () => {
  it('counts the open alerts, and none when the read fails', async () => {
    const { http } = setUp();
    const badge = TestBed.inject(SecurityTabBadge);

    const counted = firstValueFrom(badge.count('me/app'));
    http.expectOne('/api/security?repo=me/app').flush(BODY);
    expect(await counted).toBe(3);

    const failed = firstValueFrom(badge.count('me/app'));
    http.expectOne('/api/security?repo=me/app').flush('down', { status: 502, statusText: 'Bad' });
    expect(await failed).toBeNull();
  });
});
