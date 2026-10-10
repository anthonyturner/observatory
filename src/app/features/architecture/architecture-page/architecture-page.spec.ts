import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { PlanetPortraits } from '../../../shared/planets/planet-portraits';
import { ArchitecturePage } from './architecture-page';

const node = (name: string, extra: Record<string, unknown> = {}) => ({
  id: `core/${name}.ts#${name}`,
  name,
  kind: 'service',
  file: `core/${name}.ts`,
  area: 'core',
  group: '',
  providedIn: 'root',
  windows: [],
  ...extra,
});

const MAP = {
  schema: 3,
  project: 'app',
  scannedAt: '2026-10-09T12:00:00.000Z',
  areas: [{ id: 'core', label: 'Core', runtime: 'browser', folder: 'src/app/core' }],
  windows: [],
  nodes: [node('ClockService'), node('AlarmService')],
  edges: [
    {
      from: 'core/AlarmService.ts#AlarmService',
      to: 'core/ClockService.ts#ClockService',
      kind: 'injects',
      how: 'inject',
      members: [],
    },
  ],
};

function render() {
  const params = new BehaviorSubject(convertToParamMap({ owner: 'me', repo: 'app' }));
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: ActivatedRoute, useValue: { paramMap: params } },
      { provide: PlanetPortraits, useValue: { painter: () => signal(null) } },
    ],
  });
  const fixture = TestBed.createComponent(ArchitecturePage);
  const http = TestBed.inject(HttpTestingController);
  fixture.detectChanges();
  return { fixture, http, params, element: fixture.nativeElement as HTMLElement };
}

function readyPage() {
  const page = render();
  page.http.expectOne('/api/architecture?repo=me/app').flush(MAP);
  page.fixture.detectChanges();
  return page;
}

describe('ArchitecturePage', () => {
  it('charts the classes of the project on its Architecture tab', () => {
    const { element } = readyPage();

    expect(element.querySelector('h1')?.textContent).toBe('Architecture');
    expect(
      element.querySelector('app-project-tabs a[aria-current="page"]')?.getAttribute('href'),
    ).toBe('/p/me/app/architecture');
    expect(element.querySelector('.stamp')?.textContent).toContain('me/app · 2 nodes · 1 link');
    expect(element.querySelector('app-star-view')).not.toBeNull();
    expect(element.querySelector('.facts h2')?.textContent).toBe('ClockService');
  });

  it('switches to the UML diagram', () => {
    const { fixture, element } = readyPage();

    element.querySelectorAll<HTMLButtonElement>('.views button')[1].click();
    fixture.detectChanges();

    expect(element.querySelector('app-uml-view')).not.toBeNull();
    expect(element.querySelector('app-star-view')).toBeNull();
  });

  it('opens the full map of this project in a tab of its own', () => {
    const { element } = readyPage();

    const link = element.querySelector<HTMLAnchorElement>('a.abtn');

    expect(link?.textContent).toContain('Open full map');
    expect(link?.getAttribute('href')).toBe('/api/architecture/html?repo=me%2Fapp');
    expect(link?.target).toBe('_blank');
  });

  it('says there is no clone when the API answers not found, and offers no full map', () => {
    const { fixture, http, element } = render();
    http
      .expectOne('/api/architecture?repo=me/app')
      .flush({ error: 'No local clone' }, { status: 404, statusText: 'Not Found' });
    fixture.detectChanges();

    expect(element.querySelector('.state')?.textContent).toContain('No clone of this project here');
    expect(element.querySelector('a.abtn')).toBeNull();
  });

  it('says so when the clone holds no Angular classes', () => {
    const { fixture, http, element } = render();
    http.expectOne('/api/architecture?repo=me/app').flush({ ...MAP, nodes: [], edges: [] });
    fixture.detectChanges();

    expect(element.querySelector('.state')?.textContent).toContain('No Angular classes');
  });

  it('scans the clone again when refreshed', () => {
    const { fixture, http, element } = readyPage();

    element.querySelector<HTMLButtonElement>('.abtn.quiet')?.click();
    fixture.detectChanges();

    http.expectOne('/api/architecture?repo=me/app&fresh=1').flush(MAP);
    fixture.detectChanges();
    expect(element.querySelector('app-star-view')).not.toBeNull();
  });

  it('reads another project, with a clean slate, when the route changes', () => {
    const { fixture, http, params, element } = readyPage();

    params.next(convertToParamMap({ owner: 'me', repo: 'other' }));
    fixture.detectChanges();

    http.expectOne('/api/architecture?repo=me/other').flush({ ...MAP, project: 'other' });
    fixture.detectChanges();
    expect(element.querySelector('.stamp')?.textContent).toContain('me/other');
  });
});
