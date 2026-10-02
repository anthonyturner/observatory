import { graphOf, neighbourhoodOf } from './architecture-graph';
import {
  ArchitectureArea,
  ArchitectureEdge,
  ArchitectureNode,
  EdgeKind,
} from './architecture.types';
import { DEPENDENCIES_LABEL, starSystem } from './star-layout';

const AREAS: ArchitectureArea[] = [
  { id: 'core', label: 'Core' },
  { id: 'ui', label: 'Interface' },
];

const node = (name: string, area = 'core'): ArchitectureNode => ({
  id: name,
  name,
  kind: 'service',
  file: `${area}/${name}.ts`,
  area,
  group: '',
  providedIn: null,
  windows: [],
});

const edge = (
  from: string,
  to: string,
  members: string[] = [],
  kind: EdgeKind = 'injects',
): ArchitectureEdge => ({
  from,
  to,
  kind,
  how: kind === 'injects' ? 'inject' : null,
  members,
});

function systemAround(centre: string, nodes: ArchitectureNode[], edges: ArchitectureEdge[]) {
  const graph = graphOf({
    schema: 2,
    project: '',
    scannedAt: '',
    areas: AREAS,
    windows: [],
    nodes,
    edges,
  });
  const around = neighbourhoodOf(graph, centre, { area: null, window: null });
  if (!around) throw new Error(`no ${centre}`);
  return starSystem(around, AREAS);
}

const readersIn = (area: string, count: number): ArchitectureNode[] =>
  Array.from({ length: count }, (_, index) => node(`${area}Reader${index}`, area));

describe('starSystem', () => {
  it('has no orbits for a lonely node', () => {
    const system = systemAround('ClockService', [node('ClockService')], []);
    expect(system.sun.node.name).toBe('ClockService');
    expect(system.orbits).toEqual([]);
  });

  it('puts what the sun depends on on the first ring, labelled Depends on', () => {
    const system = systemAround(
      'AlarmHandler',
      [node('AlarmHandler'), node('ClockService'), node('UiReader', 'ui')],
      [edge('AlarmHandler', 'ClockService'), edge('UiReader', 'AlarmHandler')],
    );
    expect(system.orbits.map((o) => [o.kind, o.label])).toEqual([
      ['dependencies', DEPENDENCIES_LABEL],
      ['area', 'Interface'],
    ]);
    expect(system.orbits[0]?.radius).toBeLessThan(system.orbits[1]?.radius ?? 0);
  });

  it('makes one band per area with dependents, in the areas order', () => {
    const readers = [...readersIn('ui', 1), ...readersIn('core', 1)];
    const system = systemAround(
      'ClockService',
      [node('ClockService'), ...readers],
      readers.map((r) => edge(r.name, 'ClockService')),
    );
    expect(system.orbits.map((o) => o.label)).toEqual(['Core', 'Interface']);
  });

  it('spills a full band onto another ring with an empty label', () => {
    const readers = readersIn('ui', 7);
    const system = systemAround(
      'ClockService',
      [node('ClockService'), ...readers],
      readers.map((r) => edge(r.name, 'ClockService')),
    );
    expect(system.orbits.map((o) => [o.label, o.planets.length])).toEqual([
      ['Interface', 5],
      ['', 2],
    ]);
  });

  it('shows at most eight moons and counts the rest as hidden', () => {
    const members = Array.from({ length: 11 }, (_, i) => `member${i}`);
    const system = systemAround(
      'AlarmHandler',
      [node('AlarmHandler'), node('ClockService')],
      [edge('AlarmHandler', 'ClockService', members)],
    );
    const planet = system.orbits[0]?.planets[0];
    expect(planet?.moons).toHaveLength(8);
    expect(planet?.hiddenMoons).toBe(3);
  });

  it('draws each spoke in the first kind of its link, and names every kind', () => {
    const system = systemAround(
      'FaceComponent',
      [node('FaceComponent'), node('DialComponent'), node('ClockService')],
      [
        edge('FaceComponent', 'DialComponent', [], 'uses'),
        edge('FaceComponent', 'ClockService', [], 'provides'),
        edge('FaceComponent', 'ClockService'),
      ],
    );
    expect(system.orbits[0]?.planets.map((p) => [p.entry.node.name, p.link, p.relation])).toEqual([
      ['DialComponent', 'uses', 'uses'],
      ['ClockService', 'injects', 'injects, provides'],
    ]);
  });

  it('widens the view box to hold the outermost ring', () => {
    const lonely = systemAround('ClockService', [node('ClockService')], []);
    const busy = systemAround(
      'AlarmHandler',
      [node('AlarmHandler'), node('ClockService')],
      [edge('AlarmHandler', 'ClockService')],
    );
    const width = (viewBox: string) => Number(viewBox.split(' ')[2]);
    expect(width(busy.viewBox)).toBeGreaterThan(width(lonely.viewBox));
  });
});
