import {
  EntryFilter,
  HOT_DEPENDENTS,
  countOf,
  entriesMatching,
  graphOf,
  memberUse,
  neighbourhoodOf,
  Scope,
} from './architecture-graph';
import {
  ArchitectureEdge,
  ArchitectureMap,
  ArchitectureNode,
  EdgeKind,
  NodeKind,
} from './architecture.types';

/** Ids are names here, as in a map from before ids existed; one test gives two nodes one name. */
const node = (name: string, kind: NodeKind = 'service', area = 'core'): ArchitectureNode => ({
  id: name,
  name,
  kind,
  file: `${area}/${name}.ts`,
  area,
  group: '',
  providedIn: null,
  windows: [],
});

const hostedBy = (windows: string[], hosted: ArchitectureNode): ArchitectureNode => ({
  ...hosted,
  windows,
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

const EVERYWHERE: Scope = { area: null, window: null };

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
    expect(graph.byId.get('ClockService')).toMatchObject({ dependents: 1, dependencies: 0 });
    expect(graph.byId.get('AlarmHandler')).toMatchObject({ dependents: 0, dependencies: 1 });
  });

  it('marks a node nothing depends on as unused, but never a component or a provider list', () => {
    const graph = graphOf(
      mapOf([
        node('ClockService'),
        node('DialComponent', 'component'),
        node('appConfig', 'providers'),
      ]),
    );
    expect(graph.byId.get('ClockService')?.heat).toBe('unused');
    expect(graph.byId.get('DialComponent')?.heat).toBe('plain');
    expect(graph.byId.get('appConfig')?.heat).toBe('plain');
  });

  it('counts a pair joined by several kinds of edge once', () => {
    const graph = graphOf(
      mapOf(
        [node('ClockService'), node('FaceComponent', 'component')],
        [
          edge('FaceComponent', 'ClockService', [], 'provides'),
          edge('FaceComponent', 'ClockService'),
        ],
      ),
    );
    expect(graph.byId.get('ClockService')).toMatchObject({ dependents: 1, heat: 'plain' });
    expect(graph.byId.get('FaceComponent')?.dependencies).toBe(1);
  });

  it('keeps two nodes of one name apart by id', () => {
    const twin = {
      ...node('ClockService', 'service', 'ui'),
      id: 'ui/ClockService.ts#ClockService',
    };
    const graph = graphOf(mapOf([node('ClockService'), twin]));
    expect(graph.entries).toHaveLength(2);
    expect(graph.byId.get(twin.id)?.node.area).toBe('ui');
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
    expect(hot.byId.get('ClockService')?.heat).toBe('hot');
    expect(warm.byId.get('ClockService')?.heat).toBe('plain');
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

  it('returns null for an unknown id', () => {
    expect(neighbourhoodOf(graph, 'Ghost', EVERYWHERE)).toBeNull();
  });

  it('lists every dependent and dependency when no area is chosen', () => {
    const around = neighbourhoodOf(graph, 'ClockService', EVERYWHERE);
    expect(around?.dependents.map((n) => n.entry.node.name)).toEqual([
      'AlarmHandler',
      'DialComponent',
    ]);
    expect(around?.dependencies.map((n) => [n.entry.node.name, n.members])).toEqual([
      ['TickStore', ['ticks']],
    ]);
  });

  it('keeps only neighbours in the chosen area but always keeps the centre', () => {
    const around = neighbourhoodOf(graph, 'ClockService', { area: 'ui', window: null });
    expect(around?.centre.node.name).toBe('ClockService');
    expect(around?.dependents.map((n) => n.entry.node.name)).toEqual(['DialComponent']);
    expect(around?.dependencies.map((n) => n.entry.node.name)).toEqual(['TickStore']);
  });

  it('joins every kind of edge to one neighbour into one, kinds in their listed order', () => {
    const joined = graphOf(
      mapOf(
        [node('FaceComponent', 'component'), node('ClockService')],
        [
          edge('FaceComponent', 'ClockService', [], 'provides'),
          edge('FaceComponent', 'ClockService', ['now']),
        ],
      ),
    );
    const around = neighbourhoodOf(joined, 'FaceComponent', EVERYWHERE);
    expect(around?.dependencies.map((n) => [n.entry.node.name, n.kinds, n.members])).toEqual([
      ['ClockService', ['injects', 'provides'], ['now']],
    ]);
  });

  it('keeps only neighbours the chosen window pulls in', () => {
    const windowed = graphOf(
      mapOf(
        [
          hostedBy(['wall'], node('FaceComponent', 'component')),
          hostedBy(['wall', 'pocket'], node('ClockService')),
          hostedBy(['pocket'], node('AlarmList', 'component')),
        ],
        [edge('FaceComponent', 'ClockService'), edge('AlarmList', 'ClockService')],
      ),
    );
    const around = neighbourhoodOf(windowed, 'ClockService', { area: null, window: 'pocket' });
    expect(around?.dependents.map((n) => n.entry.node.name)).toEqual(['AlarmList']);
  });
});

describe('entriesMatching', () => {
  const graph = graphOf(
    mapOf(
      [
        node('ClockService', 'service', 'core'),
        hostedBy(['wall'], node('DialStore', 'store', 'ui')),
        node('DialComponent', 'component', 'ui'),
      ],
      [edge('DialComponent', 'DialStore')],
    ),
  );
  const none: EntryFilter = { query: '', area: null, window: null, heat: null };
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

  it('narrows by window', () => {
    expect(names({ window: 'wall' })).toEqual(['DialStore']);
    expect(names({ window: 'pocket' })).toEqual([]);
  });

  it('returns everything for an empty filter', () => {
    expect(names({})).toHaveLength(3);
  });
});

describe('memberUse', () => {
  it('counts the dependents reading each member, most read first then by name', () => {
    const [entry] = graphOf(mapOf([node('ClockService')])).entries;
    if (!entry) throw new Error('no entry');
    const neighbour = (members: string[]) => ({ entry, members, kinds: ['injects' as const] });
    expect(
      memberUse([neighbour(['zone', 'now']), neighbour(['now']), neighbour(['alarm'])]),
    ).toEqual([
      { member: 'now', readers: 2 },
      { member: 'alarm', readers: 1 },
      { member: 'zone', readers: 1 },
    ]);
  });
});
