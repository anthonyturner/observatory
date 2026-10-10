import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { graphOf, neighbourhoodOf } from '../../../core/architecture/architecture-graph';
import { ArchitectureNode, NodeKind } from '../../../core/architecture/architecture.types';
import { StarSystem, starSystem } from '../../../core/architecture/star-layout';
import { ELEMENT_SIZE } from '../../../shared/element-size/element-size';
import { PlanetPortraits } from '../../../shared/planets/planet-portraits';
import { PortraitPainter } from '../../../shared/planets/planet-portrait.types';
import { StarView } from './star-view';

const node = (name: string, kind: NodeKind = 'service'): ArchitectureNode => ({
  id: name,
  name,
  kind,
  file: `core/${name}.ts`,
  area: 'core',
  group: '',
  providedIn: null,
  windows: [],
  marks: [],
  endpoint: null,
});

function rosterSystem(kinds: Partial<Record<string, NodeKind>> = {}): StarSystem {
  const nodes = ['RosterService', 'ClockService', 'MatchService'].map((name) =>
    node(name, kinds[name]),
  );
  const graph = graphOf({
    project: '',
    scannedAt: '',
    runtimes: [],
    areas: [{ id: 'core', label: 'Core', runtime: 'browser' }],
    windows: [],
    nodes,
    edges: [
      { from: 'RosterService', to: 'ClockService', kind: 'injects', how: 'inject', members: [] },
      { from: 'MatchService', to: 'RosterService', kind: 'injects', how: 'inject', members: [] },
    ],
  });
  const around = neighbourhoodOf(graph, 'RosterService', { area: null, window: null });
  if (!around) throw new Error('no RosterService');
  return starSystem(around, [{ id: 'core', label: 'Core', runtime: 'browser' }]);
}

function mount(painter: PortraitPainter | null, system = rosterSystem()) {
  TestBed.configureTestingModule({
    providers: [
      { provide: PlanetPortraits, useValue: { painter: () => signal(painter) } },
      { provide: ELEMENT_SIZE, useValue: () => of({ width: 800, height: 600 }) },
    ],
  });
  const fixture = TestBed.createComponent(StarView);
  fixture.componentRef.setInput('system', system);
  fixture.detectChanges();
  return fixture;
}

const render = (painter: PortraitPainter | null): HTMLElement =>
  mount(painter).nativeElement as HTMLElement;

const fakePainter = (): PortraitPainter => ({
  world: () => 'data:image/png;base64,world',
  sun: () => 'data:image/png;base64,sun',
  dispose: () => undefined,
});

describe('StarView', () => {
  it('marks each planet with its kind and names the kind in its tooltip', () => {
    const system = rosterSystem({ ClockService: 'external', MatchService: 'route' });
    const host = mount(null, system).nativeElement as HTMLElement;
    const planets = Array.from(host.querySelectorAll('.planet'), (planet) => [
      planet.getAttribute('data-kind'),
      planet.querySelector('title')?.textContent?.replace(/\s+/g, ' ').trim(),
    ]);
    expect(planets).toEqual([
      ['external', 'ClockService · outside service · injects'],
      ['route', 'MatchService · route · injects'],
    ]);
  });

  it('draws flat bodies while there is no painter', () => {
    const host = render(null);
    expect(host.querySelectorAll('image')).toHaveLength(0);
    expect(host.querySelector('.sun .body')).not.toBeNull();
    expect(host.querySelectorAll('.planet .body')).toHaveLength(2);
  });

  it('shows a painted world for each planet and a painted sun', () => {
    const host = render(fakePainter());
    const images = Array.from(host.querySelectorAll('image'), (image) =>
      image.getAttribute('href'),
    );
    expect(images.filter((href) => href?.endsWith('world'))).toHaveLength(2);
    expect(images.filter((href) => href?.endsWith('sun'))).toHaveLength(1);
    expect(host.classList).toContain('real');
  });

  it('lights each world from the sun at the centre', () => {
    const painter = fakePainter();
    const world = vi.spyOn(painter, 'world');
    render(painter);
    for (const [portrait] of world.mock.calls) {
      expect(Math.hypot(portrait.towardSun.x, portrait.towardSun.y)).toBeCloseTo(1);
    }
    expect(world).toHaveBeenCalledTimes(2);
  });

  it('still recentres on a planet clicked over its picture', () => {
    const fixture = mount(fakePainter());
    const picked: string[] = [];
    fixture.componentInstance.pick.subscribe((id) => picked.push(id));
    const host = fixture.nativeElement as HTMLElement;
    host
      .querySelector<SVGGElement>('.planet[aria-label="Centre on ClockService"]')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(picked).toEqual(['ClockService']);
  });

  it('opens with the system placed in the frame and zoom buttons beside it', () => {
    const host = render(null);
    expect(host.querySelector('svg > g')?.getAttribute('transform')).toMatch(
      /^translate\(400 300\)/,
    );
    expect(
      Array.from(
        host.querySelectorAll('.zoom button'),
        (b) => b.getAttribute('aria-label') ?? b.textContent?.trim(),
      ),
    ).toEqual(['Zoom in', 'Zoom out', 'Fit', 'Reset']);
  });

  it('falls back to flat bodies when painting fails', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const painter = fakePainter();
    vi.spyOn(painter, 'world').mockImplementation(() => {
      throw new Error('context lost');
    });
    const host = render(painter);
    expect(host.querySelectorAll('image')).toHaveLength(0);
    expect(warn).toHaveBeenCalled();
  });
});
