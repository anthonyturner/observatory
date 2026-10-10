import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject, of } from 'rxjs';
import { ELEMENT_SIZE } from '../../../shared/element-size/element-size';
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
      { provide: ELEMENT_SIZE, useValue: () => of({ width: 800, height: 600 }) },
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
  it('charts the classes of the project', () => {
    const { element } = readyPage();

    expect(element.querySelector('h1')?.textContent).toBe('Architecture');
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

  it('says so only when the scan found nothing at all', () => {
    const { fixture, http, element } = render();
    http.expectOne('/api/architecture?repo=me/app').flush({ ...MAP, nodes: [], edges: [] });
    fixture.detectChanges();

    expect(element.querySelector('.state')?.textContent).toContain('found no source code');
    expect(element.querySelector('app-star-view')).toBeNull();
  });

  describe('for a project with no Angular classes', () => {
    const scanned = (id: string, name: string, kind: string, area: string, extra = {}) => ({
      ...node(name, { id, kind, area, file: kind === 'external' ? '' : id }),
      marks: [],
      endpoint: null,
      ...extra,
    });
    const flow = (from: string, to: string, kind: string) => ({
      from,
      to,
      kind,
      how: null,
      members: [],
    });
    const SERVER_MAP = {
      ...MAP,
      areas: [
        { id: 'server:queue', label: 'Queue', runtime: 'server', folder: 'server/queue' },
        { id: 'web-service', label: 'Web services', runtime: 'web-service', folder: '' },
      ],
      runtimes: [
        { id: 'server', label: 'API server', kind: 'server', root: 'server' },
        { id: 'web-service', label: 'Web services', kind: 'web-service', root: '' },
      ],
      nodes: [
        scanned('server/main.ts', 'main', 'module', 'server:queue', { marks: [] }),
        scanned('server/queue.ts', 'queue', 'module', 'server:queue', { marks: ['unused'] }),
        scanned('route:GET /api/queue', 'GET /api/queue', 'route', 'server:queue'),
        scanned('external:api.github.com', 'api.github.com', 'external', 'web-service'),
      ],
      edges: [
        flow('server/main.ts', 'route:GET /api/queue', 'imports'),
        flow('route:GET /api/queue', 'server/queue.ts', 'handles'),
        flow('server/queue.ts', 'external:api.github.com', 'reaches'),
      ],
    };

    function serverPage() {
      const page = render();
      page.http.expectOne('/api/architecture?repo=me/app').flush(SERVER_MAP);
      page.fixture.detectChanges();
      return page;
    }

    it('draws its modules, routes and outside services instead of the empty message', () => {
      const { element } = serverPage();

      expect(element.querySelector('.state')).toBeNull();
      expect(element.querySelector('app-star-view')).not.toBeNull();
      expect(element.querySelector('.stamp')?.textContent).toContain('4 nodes · 3 links');
      expect(element.querySelectorAll('app-node-index .row')).toHaveLength(4);
    });

    it('names the kinds it holds in the legend, and no others', () => {
      const { element } = serverPage();
      const legend = (label: string) =>
        [...element.querySelectorAll(`ul[aria-label="${label}"] li`)].map((li) =>
          li.textContent?.trim(),
        );

      expect(legend('Node kinds')).toEqual(['module', 'route', 'outside service']);
      expect(legend('Link kinds')).toEqual(['imports', 'handles', 'reaches']);
    });

    it('flags unused code from the scanner marks, not from a count of dependents', () => {
      const { element } = serverPage();
      const unusedChip = element.querySelector('.chips [data-heat="unused"]');

      expect(unusedChip?.textContent).toContain('Unused 1');
    });

    it('groups the area filter by runtime', () => {
      const { element } = serverPage();
      const groups = [...element.querySelectorAll('app-node-index optgroup')].map((group) =>
        group.getAttribute('label'),
      );

      expect(groups).toEqual(['API server', 'Web services']);
    });

    it('shows an outside service with no file path', () => {
      const { fixture, element } = serverPage();

      element
        .querySelector<HTMLButtonElement>('app-node-index .row[title="outside service"]')
        ?.click();
      fixture.detectChanges();

      expect(element.querySelector('.facts h2')?.textContent).toBe('api.github.com');
      expect(element.querySelector('.facts .kind')?.textContent).toContain('outside service');
      expect(element.querySelector('.facts .file')).toBeNull();
    });
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
