import { parseArchitecture } from './architecture-parse';

const node = (name: string, extra: Record<string, unknown> = {}) => ({
  id: `core/${name}.ts#${name}`,
  name,
  kind: 'service',
  file: `core/${name}.ts`,
  area: 'core',
  group: '',
  providedIn: 'root',
  windows: ['desktop'],
  ...extra,
});

const idOf = (name: string) => `core/${name}.ts#${name}`;

const edge = (from: string, to: string, extra: Record<string, unknown> = {}) => ({
  from: idOf(from),
  to: idOf(to),
  kind: 'injects',
  how: 'inject',
  members: ['now'],
  ...extra,
});

const body = (nodes: unknown[], edges: unknown[] = [], extra: Record<string, unknown> = {}) => ({
  schema: 3,
  project: 'clockwork',
  scannedAt: '2026-10-01T00:00:00Z',
  areas: [{ id: 'core', label: 'Core' }],
  windows: ['desktop'],
  nodes,
  edges,
  ...extra,
});

describe('parseArchitecture', () => {
  it('returns null for anything that is not a map', () => {
    expect(parseArchitecture(null)).toBeNull();
    expect(parseArchitecture([])).toBeNull();
    expect(parseArchitecture({ nodes: [] })).toBeNull();
  });

  it('reads a well-formed map whole', () => {
    const map = parseArchitecture(
      body([node('ClockService'), node('AlarmHandler')], [edge('AlarmHandler', 'ClockService')]),
    );
    expect(map?.project).toBe('clockwork');
    expect(map?.areas).toEqual([{ id: 'core', label: 'Core' }]);
    expect(map?.windows).toEqual(['desktop']);
    expect(map?.nodes.map((n) => [n.id, n.windows])).toEqual([
      [idOf('ClockService'), ['desktop']],
      [idOf('AlarmHandler'), ['desktop']],
    ]);
    expect(map?.edges).toEqual([
      {
        from: idOf('AlarmHandler'),
        to: idOf('ClockService'),
        kind: 'injects',
        how: 'inject',
        members: ['now'],
      },
    ]);
  });

  it('reads the new node and edge kinds, with no injection style on a non-injection edge', () => {
    const map = parseArchitecture(
      body(
        [node('FaceComponent', { kind: 'component' }), node('CLOCK', { kind: 'token' })],
        [edge('FaceComponent', 'CLOCK', { kind: 'provides', how: null, members: [] })],
      ),
    );
    expect(map?.nodes.map((n) => n.kind)).toEqual(['component', 'token']);
    expect(map?.edges[0]).toMatchObject({ kind: 'provides', how: null });
  });

  it('drops nodes that are malformed', () => {
    const map = parseArchitecture(
      body([node('ClockService'), node(''), node('TickStore', { file: 7 }), 'nope']),
    );
    expect(map?.nodes.map((n) => n.name)).toEqual(['ClockService']);
  });

  it('drops a node of an unknown kind', () => {
    const map = parseArchitecture(body([node('ClockService'), node('Odd', { kind: 'pipe' })]));
    expect(map?.nodes.map((n) => n.name)).toEqual(['ClockService']);
  });

  it('drops edges whose ends are not nodes', () => {
    const map = parseArchitecture(
      body(
        [node('ClockService'), node('AlarmHandler')],
        [
          edge('AlarmHandler', 'ClockService'),
          edge('AlarmHandler', 'Ghost'),
          edge('Ghost', 'ClockService'),
        ],
      ),
    );
    expect(map?.edges.map((e) => `${e.from}>${e.to}`)).toEqual([
      `${idOf('AlarmHandler')}>${idOf('ClockService')}`,
    ]);
  });

  it('drops an edge of an unknown kind, and forgets an unknown injection style', () => {
    const map = parseArchitecture(
      body(
        [node('ClockService'), node('AlarmHandler')],
        [
          edge('AlarmHandler', 'ClockService', { kind: 'haunts' }),
          edge('ClockService', 'AlarmHandler', { how: 'magic' }),
        ],
      ),
    );
    expect(map?.edges.map((e) => [e.kind, e.how])).toEqual([['injects', null]]);
  });

  it('defaults a missing group to empty, providedIn to null and windows to none', () => {
    const map = parseArchitecture(
      body([
        { ...node('ClockService'), group: undefined, providedIn: undefined, windows: undefined },
      ]),
    );
    expect(map?.nodes[0]).toMatchObject({ group: '', providedIn: null, windows: [] });
  });

  it('drops a node with no id and an edge with no kind', () => {
    const map = parseArchitecture(
      body(
        [node('ClockService'), node('AlarmHandler'), node('Anon', { id: undefined })],
        [
          edge('AlarmHandler', 'ClockService', { kind: undefined }),
          edge('ClockService', 'AlarmHandler'),
        ],
      ),
    );
    expect(map?.nodes.map((n) => n.name)).toEqual(['ClockService', 'AlarmHandler']);
    expect(map?.edges.map((e) => e.from)).toEqual([idOf('ClockService')]);
  });

  it('keeps only the areas that hold a node it kept', () => {
    const map = parseArchitecture(
      body([node('ClockService')], [], {
        areas: [
          { id: 'core', label: 'Core' },
          { id: 'server:app', label: 'App' },
        ],
      }),
    );
    expect(map?.areas).toEqual([{ id: 'core', label: 'Core' }]);
  });

  it('keeps a version 3 map’s classes and drops the nodes and links this page cannot draw', () => {
    const route = node('GET /api/queue', {
      id: 'route:GET /api/queue',
      kind: 'route',
      area: 'server:app',
    });
    const module = node('queue', { id: 'server/queue.ts', kind: 'module', area: 'server:queue' });
    const map = parseArchitecture(
      body(
        [node('ClockService'), node('AlarmHandler'), route, module],
        [
          edge('AlarmHandler', 'ClockService', { marks: ['cycle'] }),
          { from: idOf('AlarmHandler'), to: route.id, kind: 'requests', how: null, members: [] },
          { from: route.id, to: module.id, kind: 'handles', how: null, members: [] },
        ],
        {
          schema: 3,
          areas: [{ id: 'core', label: 'Core', runtime: 'browser', folder: 'src/app' }],
        },
      ),
    );
    expect(map?.nodes.map((n) => n.id)).toEqual([idOf('ClockService'), idOf('AlarmHandler')]);
    expect(map?.edges.map((e) => [e.from, e.to])).toEqual([
      [idOf('AlarmHandler'), idOf('ClockService')],
    ]);
    expect(map?.areas).toEqual([{ id: 'core', label: 'Core' }]);
  });
});
