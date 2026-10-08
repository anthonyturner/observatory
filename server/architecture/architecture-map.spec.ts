import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { architectureMap, type MapInputs } from './architecture-map.ts';
import { type ArchitectureRuntime, type EdgeKind, MAP_SCHEMA } from './architecture-types.ts';
import { mapProblems } from './map-problems.ts';
import type {
  ScannedDeclaration,
  ScannedFile,
  ScannedReference,
  ScannedSource,
} from './scanned-source.ts';

const BROWSER: ArchitectureRuntime = {
  id: 'browser',
  label: 'Browser app',
  kind: 'browser',
  root: 'src/app',
};

const ref = (
  target: string,
  kind: EdgeKind = 'injects',
  members: string[] = [],
): ScannedReference => ({
  target,
  kind,
  how: kind === 'injects' ? 'inject' : null,
  members,
});

const decl = (
  name: string,
  references: ScannedReference[] = [],
  extra: Partial<ScannedDeclaration> = {},
): ScannedDeclaration => ({
  name,
  sort: 'Injectable',
  providedIn: null,
  references,
  element: null,
  templateUrl: null,
  tags: [],
  members: [],
  ...extra,
});

const component = (name: string, extra: Partial<ScannedDeclaration> = {}) =>
  decl(name, [], { sort: 'Component', ...extra });

const file = (
  path: string,
  declarations: ScannedDeclaration[],
  extra: Partial<ScannedSource> = {},
): ScannedFile => ({
  file: path,
  declarations,
  imports: [],
  bindings: [],
  routes: [],
  caseRoutes: [],
  loc: 0,
  exports: [],
  specifiers: [],
  constants: [],
  bootstrapped: [],
  endpoints: [],
  outbound: [],
  ...extra,
});

type Setting = Partial<Pick<MapInputs, 'windows' | 'runtimes' | 'entryFiles'>>;

const mapOf = (
  { windows = [], runtimes = [BROWSER], entryFiles = [] }: Setting,
  ...files: ScannedFile[]
) =>
  architectureMap({
    project: 'clockwork',
    scannedAt: '2026-10-01T00:00:00Z',
    windows,
    runtimes,
    entryFiles,
    files,
    aliases: [{ prefix: '@/', target: 'src/' }],
    graph: { imports: [], cycles: [] },
    churn: new Map(),
    churnDays: 0,
  });

const linksOf = (map: ReturnType<typeof mapOf>) =>
  map.edges.map(({ from, to, kind }) => `${from} ${kind} ${to}`);

describe('architectureMap: nodes', () => {
  it('names each kind from the declaration and the class name, sorted by id', () => {
    const map = mapOf(
      {},
      file('src/app/core/all.ts', [
        decl('AlarmHandler'),
        decl('TickStore'),
        decl('ClockService'),
        component('DialComponent'),
        decl('CLOCK_SOURCE', [], { sort: 'InjectionToken' }),
        decl('createFitter', [], { sort: 'function' }),
        decl('TICK_PROVIDERS', [], { sort: 'providers' }),
      ]),
    );
    assert.deepEqual(
      map.nodes.map(({ name, kind }) => [name, kind]),
      [
        ['AlarmHandler', 'handler'],
        ['CLOCK_SOURCE', 'token'],
        ['ClockService', 'service'],
        ['DialComponent', 'component'],
        ['TICK_PROVIDERS', 'providers'],
        ['TickStore', 'store'],
        ['createFitter', 'function'],
      ],
    );
  });

  it('places each node by its file and keys it by file and name', () => {
    const map = mapOf({}, file('src/app/core/time/clock.ts', [decl('ClockService')]));
    const [clock] = map.nodes;
    assert.deepEqual(
      [clock?.id, clock?.area, clock?.group, clock?.file],
      [
        'src/app/core/time/clock.ts#ClockService',
        'browser:core',
        'time',
        'src/app/core/time/clock.ts',
      ],
    );
  });

  it('keeps two classes of one name in different files apart', () => {
    const map = mapOf(
      {},
      file('src/app/core/a.ts', [decl('ClockService')]),
      file('src/app/ui/b.ts', [decl('ClockService')]),
    );
    assert.deepEqual(
      map.nodes.map(({ id }) => id),
      ['src/app/core/a.ts#ClockService', 'src/app/ui/b.ts#ClockService'],
    );
  });

  it('skips files outside every runtime’s folder', () => {
    const map = mapOf({}, file('src/elsewhere/a.ts', [decl('ClockService')]));
    assert.deepEqual(map.nodes, []);
  });

  it('lists only the areas that hold a node, with their folders, and stamps the schema', () => {
    const map = mapOf(
      {},
      file('src/app/core/a.ts', [decl('ClockService')]),
      file('src/app/shell.ts', [component('ShellComponent')]),
      file('src/app/ui/plain.ts', []),
    );
    assert.deepEqual(map.areas, [
      { id: 'browser:.', label: 'Shell', runtime: 'browser', folder: 'src/app' },
      { id: 'browser:core', label: 'Core', runtime: 'browser', folder: 'src/app/core' },
    ]);
    assert.deepEqual(
      map.runtimes.map(({ id }) => id),
      ['browser'],
    );
    assert.equal(map.schema, MAP_SCHEMA);
  });

  it('copies a class’s members, and its file’s lines of code and churn, onto its nodes', () => {
    const member = { name: 'now', kind: 'method', visibility: 'public' } as const;
    const map = architectureMap({
      project: 'clockwork',
      scannedAt: '2026-10-01T00:00:00Z',
      windows: [],
      runtimes: [BROWSER],
      entryFiles: [],
      files: [
        file('src/app/core/a.ts', [decl('ClockService', [], { members: [member] })], { loc: 12 }),
      ],
      aliases: [],
      graph: { imports: [], cycles: [] },
      churn: new Map([['src/app/core/a.ts', 3]]),
      churnDays: 90,
    });
    const [clock] = map.nodes;
    assert.deepEqual([clock?.members, clock?.loc, clock?.metrics.churn], [[member], 12, 3]);
    assert.equal(map.churnDays, 90);
  });

  it('maps a file with no declaration whole when it is on an import cycle, and not otherwise', () => {
    const map = architectureMap({
      project: 'clockwork',
      scannedAt: '2026-10-01T00:00:00Z',
      windows: [],
      runtimes: [BROWSER],
      entryFiles: [],
      files: [
        file('src/app/core/a.ts', [decl('ClockService')]),
        file('src/app/core/b.ts', []),
        file('src/app/core/c.ts', []),
      ],
      aliases: [],
      graph: {
        imports: [],
        cycles: [['src/app/core/a.ts', 'src/app/core/b.ts']],
      },
      churn: new Map(),
      churnDays: 0,
    });
    assert.deepEqual(
      map.nodes.map(({ id, kind }) => [id, kind]),
      [
        ['src/app/core/a.ts#ClockService', 'service'],
        ['src/app/core/b.ts', 'module'],
      ],
    );
  });
});

describe('architectureMap: edges', () => {
  it('drops references to unknown targets and to the declaration itself', () => {
    const map = mapOf(
      {},
      file('src/app/core/a.ts', [decl('ClockService', [ref('ClockService'), ref('Router')])]),
    );
    assert.deepEqual(map.edges, []);
  });

  it('keeps one edge per target and kind, merging members however often it is injected', () => {
    const map = mapOf(
      {},
      file('src/app/core/a.ts', [
        decl('AlarmHandler', [
          ref('ClockService', 'injects', ['now', 'zone']),
          ref('ClockService', 'injects', ['now', 'alarm']),
          ref('ClockService', 'provides'),
        ]),
        decl('ClockService'),
      ]),
    );
    assert.deepEqual(mapProblems(map), [], 'counts its fans from the edges');
    assert.deepEqual(map.edges, [
      {
        from: 'src/app/core/a.ts#AlarmHandler',
        to: 'src/app/core/a.ts#ClockService',
        kind: 'injects',
        how: 'inject',
        members: ['alarm', 'now', 'zone'],
        marks: [],
      },
      {
        from: 'src/app/core/a.ts#AlarmHandler',
        to: 'src/app/core/a.ts#ClockService',
        kind: 'provides',
        how: null,
        members: [],
        marks: [],
      },
    ]);
  });

  it('resolves a shared name through the file’s import, relative or aliased', () => {
    const map = mapOf(
      {},
      file('src/app/core/a.ts', [decl('ClockService')]),
      file('src/app/ui/b.ts', [decl('ClockService')]),
      file('src/app/ui/alarm.ts', [decl('AlarmHandler', [ref('ClockService')])], {
        imports: [{ local: 'ClockService', imported: 'ClockService', module: '../core/a' }],
      }),
      file('src/app/ui/bell.ts', [decl('BellHandler', [ref('Clock')])], {
        imports: [{ local: 'Clock', imported: 'ClockService', module: '@/app/ui/b' }],
      }),
    );
    assert.deepEqual(linksOf(map), [
      'src/app/ui/alarm.ts#AlarmHandler injects src/app/core/a.ts#ClockService',
      'src/app/ui/bell.ts#BellHandler injects src/app/ui/b.ts#ClockService',
    ]);
  });

  it('prefers a declaration in the same file, and leaves a shared name it cannot place unlinked', () => {
    const map = mapOf(
      {},
      file('src/app/core/a.ts', [
        decl('ClockService'),
        decl('AlarmHandler', [ref('ClockService')]),
      ]),
      file('src/app/ui/b.ts', [decl('ClockService')]),
      file('src/app/ui/c.ts', [decl('BellHandler', [ref('ClockService')])]),
    );
    assert.deepEqual(linksOf(map), [
      'src/app/core/a.ts#AlarmHandler injects src/app/core/a.ts#ClockService',
    ]);
  });

  it('never links a name imported from a package to a project class sharing it', () => {
    const map = mapOf(
      {},
      file('src/app/core/router.ts', [decl('Router')]),
      file('src/app/ui/a.ts', [decl('AlarmHandler', [ref('Router')])], {
        imports: [{ local: 'Router', imported: 'Router', module: '@angular/router' }],
      }),
    );
    assert.deepEqual(map.edges, []);
  });

  it('links a provider binding from the token to what it hands out', () => {
    const map = mapOf(
      {},
      file(
        'src/app/core/a.ts',
        [decl('CLOCK_SOURCE', [], { sort: 'InjectionToken' }), decl('QuartzSource')],
        {
          bindings: [{ token: 'CLOCK_SOURCE', target: 'QuartzSource' }],
        },
      ),
    );
    assert.deepEqual(linksOf(map), [
      'src/app/core/a.ts#CLOCK_SOURCE provides src/app/core/a.ts#QuartzSource',
    ]);
  });

  it('links a template tag to the one component whose selector claims it', () => {
    const map = mapOf(
      {},
      file('src/app/ui/face.ts', [component('FaceComponent', { tags: ['app-dial', 'app-twin'] })]),
      file('src/app/ui/dial.ts', [component('DialComponent', { element: 'app-dial' })]),
      file('src/app/ui/twin-a.ts', [component('TwinA', { element: 'app-twin' })]),
      file('src/app/ui/twin-b.ts', [component('TwinB', { element: 'app-twin' })]),
    );
    assert.deepEqual(linksOf(map), [
      'src/app/ui/face.ts#FaceComponent uses src/app/ui/dial.ts#DialComponent',
    ]);
  });
});

describe('architectureMap: windows', () => {
  const shell = file('src/app/app.ts', [component('ShellComponent')], {
    caseRoutes: [
      { label: 'wall', path: 'face' },
      { label: 'pocket', path: 'alarms' },
      { label: 'not-a-window', path: 'face' },
    ],
  });
  const routes = file('src/app/app.routes.ts', [], {
    routes: [
      { path: 'face', component: { name: 'FaceComponent', module: './ui/face' }, children: null },
      { path: 'alarms', component: null, children: './alarms/alarm.routes' },
    ],
  });
  const alarmRoutes = file('src/app/alarms/alarm.routes.ts', [], {
    routes: [{ path: '', component: { name: 'AlarmList', module: null }, children: null }],
    imports: [{ local: 'AlarmList', imported: 'AlarmList', module: './alarm-list' }],
  });
  const map = mapOf(
    { windows: ['wall', 'pocket', 'background'] },
    shell,
    routes,
    alarmRoutes,
    file('src/app/alarms/alarm-list.ts', [component('AlarmList', { tags: ['app-dial'] })]),
    file('src/app/ui/face.ts', [component('FaceComponent', { tags: ['app-dial'] })]),
    file('src/app/ui/dial.ts', [
      component('DialComponent', { element: 'app-dial' }),
      decl('Lonely'),
    ]),
    file('src/app/core/clock.ts', [decl('ClockService')]),
  );
  const windowsOf = (name: string) => map.nodes.find((node) => node.name === name)?.windows;

  it('hosts a window’s routed component and everything it reaches', () => {
    assert.deepEqual(windowsOf('FaceComponent'), ['wall']);
    assert.deepEqual(windowsOf('AlarmList'), ['pocket']);
    assert.deepEqual(windowsOf('DialComponent'), ['pocket', 'wall']);
  });

  it('leaves the shell and anything no window reaches unhosted', () => {
    assert.deepEqual(windowsOf('ShellComponent'), []);
    assert.deepEqual(windowsOf('Lonely'), []);
  });

  it('keeps every manifest window, hosting or not', () => {
    assert.deepEqual(map.windows, ['background', 'pocket', 'wall']);
  });
});
