import { graphOf, neighbourhoodOf } from './architecture-graph';
import {
  ArchitectureArea,
  ArchitectureEdge,
  ArchitectureNode,
  EdgeKind,
} from './architecture.types';
import { BOX_WIDTH, umlDiagram } from './uml-layout';

const AREAS: ArchitectureArea[] = [{ id: 'core', label: 'Core' }];

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

function diagramAround(centre: string, nodes: ArchitectureNode[], edges: ArchitectureEdge[]) {
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
  return umlDiagram(around, AREAS);
}

const centreBox = (diagram: ReturnType<typeof umlDiagram>) =>
  diagram.boxes.find((box) => box.role === 'centre');

describe('umlDiagram', () => {
  const diagram = diagramAround(
    'ClockService',
    [node('ClockService'), node('AlarmHandler'), node('TickStore')],
    [edge('AlarmHandler', 'ClockService', ['now']), edge('ClockService', 'TickStore')],
  );

  it('lays dependents, the centre and dependencies out in three columns left to right', () => {
    const x = (role: string) => diagram.boxes.find((box) => box.role === role)?.x ?? -1;
    expect(x('dependent')).toBeLessThan(x('centre'));
    expect(x('centre')).toBeLessThan(x('dependency'));
    expect(diagram.width).toBe(x('dependency') + BOX_WIDTH);
  });

  it('draws one link per neighbour', () => {
    expect(diagram.links).toHaveLength(2);
  });

  it('gives each link the kind of edge it stands for, and each box its relation', () => {
    const mixed = diagramAround(
      'WallClock',
      [node('WallClock'), node('BaseClock'), node('DialComponent')],
      [
        edge('WallClock', 'BaseClock', [], 'extends'),
        edge('WallClock', 'DialComponent', [], 'uses'),
      ],
    );
    expect(mixed.links.map((link) => link.kind)).toEqual(['extends', 'uses']);
    expect(mixed.boxes.map((box) => [box.title, box.relation])).toEqual([
      ['WallClock', ''],
      ['BaseClock', 'extends'],
      ['DialComponent', 'uses'],
    ]);
  });

  it('captions the columns with the neighbour counts', () => {
    expect(diagram.captions.map((c) => c.text)).toEqual([
      'Depended on by 1',
      'Centre',
      'Depends on 1',
    ]);
  });

  it('stereotypes a box with its kind and area label', () => {
    expect(centreBox(diagram)?.stereotype).toBe('«service» Core');
  });

  it('marks centre members read by more than one dependent with a count', () => {
    const shared = diagramAround(
      'ClockService',
      [node('ClockService'), node('AlarmHandler'), node('DialStore')],
      [
        edge('AlarmHandler', 'ClockService', ['now', 'zone']),
        edge('DialStore', 'ClockService', ['now']),
      ],
    );
    expect(centreBox(shared)?.lines.map((l) => l.text)).toEqual(['now  ×2', 'zone']);
  });

  it('cuts a long member list to a final line saying how many more', () => {
    const members = Array.from({ length: 10 }, (_, i) => `member${i}`);
    const cut = diagramAround(
      'AlarmHandler',
      [node('AlarmHandler'), node('ClockService')],
      [edge('AlarmHandler', 'ClockService', members)],
    );
    const lines = cut.boxes.find((box) => box.role === 'dependency')?.lines.map((l) => l.text);
    expect(lines).toHaveLength(6);
    expect(lines?.at(-1)).toBe('… 5 more');
  });

  it('ends a long name with an ellipsis in the title', () => {
    const name = 'ExtraordinarilyLongClockSynchronisationService';
    const long = diagramAround(name, [node(name)], []);
    const title = centreBox(long)?.title ?? '';
    expect(title).toHaveLength(38);
    expect(title.endsWith('…')).toBe(true);
  });
});
