import { parseArchitecture } from './architecture-parse';

const node = (name: string, extra: Record<string, unknown> = {}) => ({
  name,
  kind: 'service',
  file: `core/${name}.ts`,
  area: 'core',
  group: '',
  providedIn: 'root',
  ...extra,
});

const edge = (from: string, to: string, extra: Record<string, unknown> = {}) => ({
  from,
  to,
  how: 'inject',
  members: ['now'],
  ...extra,
});

const body = (nodes: unknown[], edges: unknown[] = []) => ({
  project: 'clockwork',
  scannedAt: '2026-10-01T00:00:00Z',
  areas: [{ id: 'core', label: 'Core' }],
  windows: ['desktop'],
  nodes,
  edges,
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
    expect(map?.nodes.map((n) => n.name)).toEqual(['ClockService', 'AlarmHandler']);
    expect(map?.edges).toEqual([
      { from: 'AlarmHandler', to: 'ClockService', how: 'inject', members: ['now'] },
    ]);
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
    expect(map?.edges.map((e) => `${e.from}>${e.to}`)).toEqual(['AlarmHandler>ClockService']);
  });

  it('drops edges with an unknown injection style', () => {
    const map = parseArchitecture(
      body(
        [node('ClockService'), node('AlarmHandler')],
        [edge('AlarmHandler', 'ClockService', { how: 'magic' })],
      ),
    );
    expect(map?.edges).toEqual([]);
  });

  it('defaults a missing group to empty and a missing providedIn to null', () => {
    const map = parseArchitecture(
      body([{ ...node('ClockService'), group: undefined, providedIn: undefined }]),
    );
    expect(map?.nodes[0]).toMatchObject({ group: '', providedIn: null });
  });
});
