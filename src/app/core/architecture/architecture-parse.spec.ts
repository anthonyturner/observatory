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
    expect(map?.areas).toEqual([{ id: 'core', label: 'Core', runtime: '' }]);
    expect(map?.windows).toEqual(['desktop']);
    expect(map?.nodes.map((n) => [n.id, n.windows, n.marks, n.endpoint])).toEqual([
      [idOf('ClockService'), ['desktop'], [], null],
      [idOf('AlarmHandler'), ['desktop'], [], null],
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
      body([
        node('ClockService'),
        node(''),
        node('TickStore', { file: 7 }),
        node('NoFile', { file: undefined }),
        'nope',
      ]),
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
    expect(map?.areas).toEqual([{ id: 'core', label: 'Core', runtime: '' }]);
  });

  it('keeps modules, routes and outside services with the links that join them', () => {
    const route = node('GET /api/queue', {
      id: 'route:GET /api/queue',
      kind: 'route',
      area: 'server:app',
      endpoint: { method: 'GET', path: '/api/queue' },
    });
    const module = node('queue', { id: 'server/queue.ts', kind: 'module', area: 'server:queue' });
    const outside = node('api.github.com', {
      id: 'external:api.github.com',
      kind: 'external',
      file: '',
      area: 'web-service',
    });
    const link = (from: string, to: string, kind: string) => ({
      from,
      to,
      kind,
      how: null,
      members: [],
    });
    const map = parseArchitecture(
      body(
        [node('ClockService'), node('AlarmHandler'), route, module, outside],
        [
          edge('AlarmHandler', 'ClockService', { marks: ['cycle'] }),
          link(idOf('AlarmHandler'), route.id, 'requests'),
          link(route.id, module.id, 'handles'),
          link(module.id, outside.id, 'reaches'),
          link(module.id, outside.id, 'spawns'),
          link(module.id, idOf('ClockService'), 'imports'),
        ],
        {
          areas: [
            { id: 'core', label: 'Core', runtime: 'browser', folder: 'src/app' },
            { id: 'server:app', label: 'App', runtime: 'server', folder: 'server/app' },
            { id: 'server:queue', label: 'Queue', runtime: 'server', folder: 'server/queue' },
            { id: 'web-service', label: 'Web services', runtime: 'web-service', folder: '' },
          ],
          runtimes: [
            { id: 'browser', label: 'Browser app', kind: 'browser', root: 'src/app' },
            { id: 'server', label: 'API server', kind: 'server', root: 'server' },
            { id: 'web-service', label: 'Web services', kind: 'web-service', root: '' },
          ],
        },
      ),
    );
    expect(map?.nodes.map((n) => [n.name, n.kind])).toEqual([
      ['ClockService', 'service'],
      ['AlarmHandler', 'service'],
      ['GET /api/queue', 'route'],
      ['queue', 'module'],
      ['api.github.com', 'external'],
    ]);
    expect(map?.nodes[2]?.endpoint).toEqual({ method: 'GET', path: '/api/queue' });
    expect(map?.nodes[4]?.file).toBe('');
    expect(map?.edges.map((e) => e.kind)).toEqual([
      'injects',
      'requests',
      'handles',
      'reaches',
      'spawns',
      'imports',
    ]);
    expect(map?.areas.map((a) => [a.id, a.runtime])).toEqual([
      ['core', 'browser'],
      ['server:app', 'server'],
      ['server:queue', 'server'],
      ['web-service', 'web-service'],
    ]);
    expect(map?.runtimes.map((r) => r.kind)).toEqual(['browser', 'server', 'web-service']);
  });

  it('reads a node marks and drops one it does not know', () => {
    const map = parseArchitecture(
      body([node('ClockService', { marks: ['unused', 'hot', 'haunted', 7] }), node('Other')]),
    );
    expect(map?.nodes.map((n) => n.marks)).toEqual([['unused', 'hot'], []]);
  });

  it('reads an endpoint only when it has both a method and a path', () => {
    const map = parseArchitecture(
      body([
        node('A', { endpoint: { method: 'GET', path: '/a' } }),
        node('B', { endpoint: { method: 'GET' } }),
        node('C', { endpoint: null }),
      ]),
    );
    expect(map?.nodes.map((n) => n.endpoint)).toEqual([{ method: 'GET', path: '/a' }, null, null]);
  });

  it('leaves an area runtime empty when the map names none, and drops a runtime of an unknown kind', () => {
    const map = parseArchitecture(
      body([node('ClockService')], [], {
        runtimes: [
          { id: 'browser', label: 'Browser app', kind: 'browser' },
          { id: 'lab', label: 'Lab', kind: 'laboratory' },
        ],
      }),
    );
    expect(map?.areas).toEqual([{ id: 'core', label: 'Core', runtime: '' }]);
    expect(map?.runtimes.map((r) => r.id)).toEqual(['browser']);
  });
});
