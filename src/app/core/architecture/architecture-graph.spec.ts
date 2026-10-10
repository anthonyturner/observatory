import {
  EntryFilter,
  countOf,
  entriesMatching,
  graphOf,
  groupAreas,
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
  NodeMark,
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
  marks: [],
  endpoint: null,
});

const hostedBy = (windows: string[], hosted: ArchitectureNode): ArchitectureNode => ({
  ...hosted,
  windows,
});

const markedAs = (marks: NodeMark[], marked: ArchitectureNode): ArchitectureNode => ({
  ...marked,
  marks,
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
  runtimes: [],
  areas: [],
  windows: [],
  nodes,
  edges,
});

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

  it('takes heat from the scanner’s marks, not from a count of dependents', () => {
    const graph = graphOf(
      mapOf([
        markedAs(['unused'], node('ClockService')),
        markedAs(['hot'], node('DialStore', 'store')),
        node('main', 'module'),
        markedAs(['hub', 'cycle'], node('TickStore', 'store')),
      ]),
    );
    expect(graph.byId.get('ClockService')?.heat).toBe('unused');
    expect(graph.byId.get('DialStore')?.heat).toBe('hot');
    expect(graph.byId.get('main')?.heat).toBe('plain');
    expect(graph.byId.get('TickStore')?.heat).toBe('plain');
    expect(countOf(graph, 'hot')).toBe(1);
  });

  it('shows a node that is both unused and hot as unused', () => {
    const graph = graphOf(mapOf([markedAs(['hot', 'unused'], node('ClockService'))]));
    expect(graph.byId.get('ClockService')?.heat).toBe('unused');
  });

  it('words every node’s kind, including the ones that are not Angular classes', () => {
    const graph = graphOf(
      mapOf([node('queue', 'module'), node('GET /api/queue', 'route'), node('git', 'external')]),
    );
    expect(['queue', 'GET /api/queue', 'git'].map((id) => graph.byId.get(id)?.kindLabel)).toEqual([
      'module',
      'route',
      'outside service',
    ]);
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

  it('follows the links that carry a request, not only code dependencies', () => {
    const flow = graphOf(
      mapOf(
        [
          node('queue-client', 'module'),
          node('GET /api/queue', 'route'),
          node('queue-routes', 'module'),
          node('api.github.com', 'external'),
        ],
        [
          edge('queue-client', 'GET /api/queue', [], 'requests'),
          edge('GET /api/queue', 'queue-routes', [], 'handles'),
          edge('queue-routes', 'api.github.com', [], 'reaches'),
        ],
      ),
    );
    const around = neighbourhoodOf(flow, 'GET /api/queue', EVERYWHERE);
    expect(around?.dependents.map((n) => [n.entry.node.name, n.kinds])).toEqual([
      ['queue-client', ['requests']],
    ]);
    expect(around?.dependencies.map((n) => [n.entry.node.name, n.kinds])).toEqual([
      ['queue-routes', ['handles']],
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
        markedAs(['unused'], node('ClockService', 'service', 'core')),
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

describe('groupAreas', () => {
  const runtimes = [
    { id: 'browser', label: 'Browser app', kind: 'browser' as const },
    { id: 'server', label: 'API server', kind: 'server' as const },
  ];
  const area = (id: string, runtime: string) => ({ id, label: id.toUpperCase(), runtime });

  it('groups areas under their runtime, in the runtimes order', () => {
    expect(
      groupAreas([area('s1', 'server'), area('b1', 'browser'), area('s2', 'server')], runtimes),
    ).toEqual([
      { label: 'Browser app', areas: [area('b1', 'browser')] },
      { label: 'API server', areas: [area('s1', 'server'), area('s2', 'server')] },
    ]);
  });

  it('leaves out a runtime with no area and puts an area of an unknown runtime last under Other', () => {
    expect(groupAreas([area('x', ''), area('s1', 'server')], runtimes)).toEqual([
      { label: 'API server', areas: [area('s1', 'server')] },
      { label: 'Other', areas: [area('x', '')] },
    ]);
  });
});
