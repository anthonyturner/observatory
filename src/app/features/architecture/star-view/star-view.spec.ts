import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { graphOf, neighbourhoodOf } from '../../../core/architecture/architecture-graph';
import { ArchitectureNode } from '../../../core/architecture/architecture.types';
import { StarSystem, starSystem } from '../../../core/architecture/star-layout';
import { PlanetPortraits } from '../../../shared/planets/planet-portraits';
import { PortraitPainter } from '../../../shared/planets/planet-portrait.types';
import { StarView } from './star-view';

const node = (name: string): ArchitectureNode => ({
  id: name,
  name,
  kind: 'service',
  file: `core/${name}.ts`,
  area: 'core',
  group: '',
  providedIn: null,
  windows: [],
});

function rosterSystem(): StarSystem {
  const graph = graphOf({
    schema: 2,
    project: '',
    scannedAt: '',
    areas: [{ id: 'core', label: 'Core' }],
    windows: [],
    nodes: [node('RosterService'), node('ClockService'), node('MatchService')],
    edges: [
      { from: 'RosterService', to: 'ClockService', kind: 'injects', how: 'inject', members: [] },
      { from: 'MatchService', to: 'RosterService', kind: 'injects', how: 'inject', members: [] },
    ],
  });
  const around = neighbourhoodOf(graph, 'RosterService', { area: null, window: null });
  if (!around) throw new Error('no RosterService');
  return starSystem(around, [{ id: 'core', label: 'Core' }]);
}

function mount(painter: PortraitPainter | null) {
  TestBed.configureTestingModule({
    providers: [{ provide: PlanetPortraits, useValue: { painter: () => signal(painter) } }],
  });
  const fixture = TestBed.createComponent(StarView);
  fixture.componentRef.setInput('system', rosterSystem());
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
