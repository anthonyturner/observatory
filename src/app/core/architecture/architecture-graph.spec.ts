import {
  EntryFilter,
  HOT_DEPENDENTS,
  countOf,
  entriesMatching,
  graphOf,
  memberUse,
  neighbourhoodOf,
} from './architecture-graph';
import {
  ArchitectureEdge,
  ArchitectureMap,
  ArchitectureNode,
  NodeKind,
} from './architecture.types';

const node = (name: string, kind: NodeKind = 'service', area = 'core'): ArchitectureNode => ({
  name,
  kind,
  file: `${area}/${name}.ts`,
  area,
  group: '',
  providedIn: null,
});

const edge = (from: string, to: string, members: string[] = []): ArchitectureEdge => ({
  from,
  to,
  how: 'inject',
  members,
});

const mapOf = (nodes: ArchitectureNode[], edges: ArchitectureEdge[] = []): ArchitectureMap => ({
  project: 'clockwork',
  scannedAt: '',
  areas: [],
  windows: [],
  nodes,
  edges,
});

const readerNodes = (count: number): ArchitectureNode[] =>
  Array.from({ length: count }, (_, index) => node(`Reader${index}`));

const readerEdges = (target: string, count: number): ArchitectureEdge[] =>
  Array.from({ length: count }, (_, index) => edge(`Reader${index}`, target));

describe('graphOf', () => {
  it('sorts entries with the most depended-on first, then by name', () => {
    const graph = graphOf(
      mapOf(
        [node('TickStore'), node('ClockService'), node('AlarmHandler'), node('DialStore')],
        [
          edge('AlarmHandler', 'ClockService'),
          edge('DialStore', 'ClockService'),
          edge('AlarmHandler', 'TickStore'),
        ],
      ),
    );
    expect(graph.entries.map((e) => e.node.name)).toEqual([
      'ClockService',
      'TickStore',
      'AlarmHandler',
      'DialStore',
    ]);
  });

  it('counts dependents and dependencies', () => {
    const graph = graphOf(
      mapOf([node('ClockService'), node('AlarmHandler')], [edge('AlarmHandler', 'ClockService')]),
    );
    expect(graph.byName.get('ClockService')).toMatchObject({ dependents: 1, dependencies: 0 });
    expect(graph.byName.get('AlarmHandler')).toMatchObject({ dependents: 0, dependencies: 1 });
  });

  it('marks an injectable nobody injects as unused, but never a component', () => {
    const graph = graphOf(mapOf([node('ClockService'), node('DialComponent', 'component')]));
    expect(graph.byName.get('ClockService')?.heat).toBe('unused');
    expect(graph.byName.get('DialComponent')?.heat).toBe('plain');
  });

  it('marks a class with at least HOT_DEPENDENTS dependents as hot', () => {
    const hot = graphOf(
      mapOf(
        [node('ClockService'), ...readerNodes(HOT_DEPENDENTS)],
        readerEdges('ClockService', HOT_DEPENDENTS),
      ),
    );
    const warm = graphOf(
      mapOf(
        [node('ClockService'), ...readerNodes(HOT_DEPENDENTS - 1)],
        readerEdges('ClockService', HOT_DEPENDENTS - 1),
      ),
    );
    expect(hot.byName.get('ClockService')?.heat).toBe('hot');
    expect(warm.byName.get('ClockService')?.heat).toBe('plain');
    expect(countOf(hot, 'hot')).toBe(1);
  });
});

describe('neighbourhoodOf', () => {
  const graph = graphOf(
    mapOf(
      [
        node('ClockService', 'service', 'core'),
        node('AlarmHandler', 'handler', 'core'),
        node('DialComponent', 'component', 'ui'),
        node('TickStore', 'store', 'ui'),
      ],
      [
        edge('AlarmHandler', 'ClockService', ['now']),
        edge('DialComponent', 'ClockService', ['zone']),
        edge('ClockService', 'TickStore', ['ticks']),
      ],
    ),
  );

  it('returns null for an unknown name', () => {
    expect(neighbourhoodOf(graph, 'Ghost', null)).toBeNull();
  });

  it('lists every dependent and dependency when no area is chosen', () => {
    const around = neighbourhoodOf(graph, 'ClockService', null);
    expect(around?.dependents.map((n) => n.entry.node.name)).toEqual([
      'AlarmHandler',
      'DialComponent',
    ]);
    expect(around?.dependencies.map((n) => [n.entry.node.name, n.members])).toEqual([
      ['TickStore', ['ticks']],
    ]);
  });

  it('keeps only neighbours in the chosen area but always keeps the centre', () => {
    const around = neighbourhoodOf(graph, 'ClockService', 'ui');
    expect(around?.centre.node.name).toBe('ClockService');
    expect(around?.dependents.map((n) => n.entry.node.name)).toEqual(['DialComponent']);
    expect(around?.dependencies.map((n) => n.entry.node.name)).toEqual(['TickStore']);
  });
});

describe('entriesMatching', () => {
  const graph = graphOf(
    mapOf(
      [
        node('ClockService', 'service', 'core'),
        node('DialStore', 'store', 'ui'),
        node('DialComponent', 'component', 'ui'),
      ],
      [edge('DialComponent', 'DialStore')],
    ),
  );
  const none: EntryFilter = { query: '', area: null, heat: null };
  const names = (filter: Partial<EntryFilter>) =>
    entriesMatching(graph, { ...none, ...filter }).map((e) => e.node.name);

  it('matches the query case-insensitively, ignoring surrounding spaces', () => {
    expect(names({ query: '  dial ' })).toEqual(['DialStore', 'DialComponent']);
  });

  it('narrows by area and by heat', () => {
    expect(names({ area: 'ui' })).toEqual(['DialStore', 'DialComponent']);
    expect(names({ heat: 'unused' })).toEqual(['ClockService']);
    expect(names({ area: 'ui', heat: 'plain', query: 'store' })).toEqual(['DialStore']);
  });

  it('returns everything for an empty filter', () => {
    expect(names({})).toHaveLength(3);
  });
});

describe('memberUse', () => {
  it('counts the dependents reading each member, most read first then by name', () => {
    const [entry] = graphOf(mapOf([node('ClockService')])).entries;
    if (!entry) throw new Error('no entry');
    const neighbour = (members: string[]) => ({ entry, members });
    expect(
      memberUse([neighbour(['zone', 'now']), neighbour(['now']), neighbour(['alarm'])]),
    ).toEqual([
      { member: 'now', readers: 2 },
      { member: 'alarm', readers: 1 },
      { member: 'zone', readers: 1 },
    ]);
  });
});
