import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { securityAlert, securityReport } from '../../../core/security/testing/security-fixture';
import { ELEMENT_SIZE } from '../../../shared/element-size/element-size';
import { PlanetPortraits } from '../../../shared/planets/planet-portraits';
import { sourceView } from '../alert-sources/alert-sources';
import { emptyMessage, securityStamp, severityLegend, unreadNote } from '../security-words';
import { SecurityPage } from './security-page';

const alert = (number: number, severity: string, kind = 'dependabot') => ({
  kind,
  number,
  severity,
  title: `Advisory ${number}`,
  where: 'lodash (npm) · package-lock.json',
  createdAt: '2026-10-04T11:00:00Z',
  url: `https://github.com/me/app/security/${kind}/${number}`,
});

const counts = (more: object = {}) => ({ critical: 0, high: 0, medium: 0, low: 0, ...more });

const REPORT = {
  generatedAt: '2026-10-07T11:00:00Z',
  repo: 'me/app',
  sources: [
    { kind: 'dependabot', status: 'read', note: null, counts: counts({ critical: 1, low: 1 }) },
    {
      kind: 'code-scanning',
      status: 'off',
      note: 'Code scanning is not set up for this repository.',
      counts: counts(),
    },
    { kind: 'secret-scanning', status: 'read', note: null, counts: counts() },
  ],
  alerts: [alert(8, 'critical'), alert(3, 'low')],
  isWithheld: false,
};

function render(body: object) {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      provideHttpClient(),
      provideHttpClientTesting(),
      {
        provide: ActivatedRoute,
        useValue: { paramMap: of(convertToParamMap({ owner: 'me', repo: 'app' })) },
      },
      { provide: ELEMENT_SIZE, useValue: () => of({ width: 1400, height: 900 }) },
      { provide: PlanetPortraits, useValue: { painter: () => signal(null) } },
    ],
  });
  const fixture = TestBed.createComponent(SecurityPage);
  const http = TestBed.inject(HttpTestingController);
  fixture.detectChanges();
  http.expectOne('/api/security?repo=me/app').flush(body);
  fixture.detectChanges();
  return { fixture, element: fixture.nativeElement as HTMLElement };
}

describe('SecurityPage', () => {
  it('opens on the list, most severe first, each alert linked, under the Security tab', () => {
    const { element } = render(REPORT);

    expect(element.querySelector('h1')?.textContent).toBe('Security');
    expect(element.querySelector('.stamp')?.textContent).toBe('me/app · 2 open alerts');
    const rows = [...element.querySelectorAll('app-alert-list a')];
    expect(rows.map((row) => row.querySelector('b')?.textContent)).toEqual([
      'Advisory 8',
      'Advisory 3',
    ]);
    expect(rows[0].getAttribute('href')).toBe('https://github.com/me/app/security/dependabot/8');
    expect(rows[0].querySelector('.meta')?.textContent).toBe('Dependabot #8 · opened 3d ago');
    expect(element.querySelector('app-alert-sources')?.textContent).toContain(
      'Code scanning is not set up for this repository.',
    );
  });

  it('shows a preview visitor the counts and a note, and no alert', () => {
    const { element } = render({ ...REPORT, alerts: [], isWithheld: true });

    expect(element.querySelector('app-alert-list')).toBeNull();
    expect(element.querySelector('.withheld')?.textContent).toContain('Sign in to see them');
    expect(element.querySelector('app-alert-sources')?.textContent).toContain('1 critical');
  });

  it('draws the same alerts as a sky, each a link', () => {
    const { fixture, element } = render(REPORT);
    element.querySelectorAll<HTMLButtonElement>('.views button')[1].click();
    fixture.detectChanges();

    const links = [...element.querySelectorAll('app-hazard-sky a')];
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      'https://github.com/me/app/security/dependabot/8',
      'https://github.com/me/app/security/dependabot/3',
    ]);
    expect(element.querySelector('.legend')?.textContent).toContain('Critical 1');
    expect(element.querySelector('.note')?.textContent).toBe(
      'Not read: Code scanning. The list says why.',
    );
  });
});

describe('Security page words', () => {
  it('says what the header, an empty list and the legend say', () => {
    const report = securityReport([securityAlert(1, 2, { severity: 'critical' })]);
    const none = securityReport([]);
    const unread = {
      ...none,
      sources: none.sources.map((source) => ({ ...source, status: 'off' as const })),
    };

    expect(securityStamp('me/app', report)).toBe('me/app · 1 open alert');
    expect(emptyMessage(report)).toBeNull();
    expect(emptyMessage(none)?.headline).toBe('No open alerts');
    expect(emptyMessage(unread)?.headline).toBe('No alerts could be read');
    expect(severityLegend(report.sources)[0].label).toBe('Critical 1');
    expect(unreadNote(report.sources)).toBeNull();
  });

  it('says a list read with nothing open has none, and otherwise its note', () => {
    const [read] = securityReport([]).sources;
    expect(sourceView(read).note).toBe('None open');
    const off = { ...read, status: 'off' as const, note: 'Dependabot alerts are off.' };
    expect(sourceView(off).note).toBe('Dependabot alerts are off.');
  });
});
