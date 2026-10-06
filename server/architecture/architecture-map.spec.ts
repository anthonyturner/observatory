import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { AreaRule } from './area-rules.ts';
import { architectureMap } from './architecture-map.ts';
import type { EdgeKind } from './architecture-types.ts';
import type {
  ScannedDeclaration,
  ScannedFile,
  ScannedReference,
  ScannedSource,
} from './scanned-source.ts';

const RULES: readonly AreaRule[] = [
  { id: 'core', label: 'Core', root: 'core' },
  { id: 'ui', label: 'Interface', root: '' },
];

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
  ...extra,
});

interface Setting {
  readonly rules?: readonly AreaRule[];
  readonly windows?: readonly string[];
}

const mapOf = ({ rules = RULES, windows = [] }: Setting, ...files: ScannedFile[]) =>
  architectureMap({
    project: 'clockwork',
    scannedAt: '2026-10-01T00:00:00Z',
    windows,
    rules,
    files,
    aliases: [{ prefix: '@/', target: 'src/' }],
  });

const linksOf = (map: ReturnType<typeof mapOf>) =>
  map.edges.map(({ from, to, kind }) => `${from} ${kind} ${to}`);

describe('architectureMap: nodes', () => {
  it('names each kind from the declaration and the class name', () => {
    const map = mapOf(
      {},
      file('core/all.ts', [
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
        ['TickStore', 'store'],
        ['ClockService', 'service'],
        ['DialComponent', 'component'],
        ['CLOCK_SOURCE', 'token'],
        ['createFitter', 'function'],
        ['TICK_PROVIDERS', 'providers'],
      ],
    );
  });

  it('places each node by its file and keys it by file and name', () => {
    const map = mapOf({}, file('core/time/clock.ts', [decl('ClockService')]));
    const [clock] = map.nodes;
    assert.deepEqual(
      [clock?.id, clock?.area, clock?.group, clock?.file],
      ['core/time/clock.ts#ClockService', 'core', 'time', 'core/time/clock.ts'],
    );
  });

  it('keeps two classes of one name in different files apart', () => {
    const map = mapOf(
      {},
      file('core/a.ts', [decl('ClockService')]),
      file('ui/b.ts', [decl('ClockService')]),
    );
    assert.deepEqual(
      map.nodes.map(({ id }) => id),
      ['core/a.ts#ClockService', 'ui/b.ts#ClockService'],
    );
  });

  it('skips files that no rule holds', () => {
    const map = mapOf(
      { rules: [{ id: 'core', label: 'Core', root: 'core' }] },
      file('elsewhere/a.ts', [decl('ClockService')]),
    );
    assert.deepEqual(map.nodes, []);
  });

  it('lists the areas without their roots and stamps the schema', () => {
    const map = mapOf({});
    assert.deepEqual(map.areas, [
      { id: 'core', label: 'Core' },
      { id: 'ui', label: 'Interface' },
    ]);
    assert.equal(map.schema, 2);
  });
});

describe('architectureMap: edges', () => {
  it('drops references to unknown targets and to the declaration itself', () => {
    const map = mapOf(
      {},
      file('core/a.ts', [decl('ClockService', [ref('ClockService'), ref('Router')])]),
    );
    assert.deepEqual(map.edges, []);
  });

  it('keeps one edge per target and kind, merging members however often it is injected', () => {
    const map = mapOf(
      {},
      file('core/a.ts', [
        decl('AlarmHandler', [
          ref('ClockService', 'injects', ['now', 'zone']),
          ref('ClockService', 'injects', ['now', 'alarm']),
          ref('ClockService', 'provides'),
        ]),
        decl('ClockService'),
      ]),
    );
    assert.deepEqual(map.edges, [
      {
        from: 'core/a.ts#AlarmHandler',
        to: 'core/a.ts#ClockService',
        kind: 'injects',
        how: 'inject',
        members: ['alarm', 'now', 'zone'],
      },
      {
        from: 'core/a.ts#AlarmHandler',
        to: 'core/a.ts#ClockService',
        kind: 'provides',
        how: null,
        members: [],
      },
    ]);
  });

  it('resolves a shared name through the file’s import, relative or aliased', () => {
    const map = mapOf(
      {},
      file('core/a.ts', [decl('ClockService')]),
      file('ui/b.ts', [decl('ClockService')]),
      file('ui/alarm.ts', [decl('AlarmHandler', [ref('ClockService')])], {
        imports: [{ local: 'ClockService', imported: 'ClockService', module: '../core/a' }],
      }),
      file('ui/bell.ts', [decl('BellHandler', [ref('Clock')])], {
        imports: [{ local: 'Clock', imported: 'ClockService', module: '@/app/ui/b' }],
      }),
    );
    assert.deepEqual(linksOf(map), [
      'ui/alarm.ts#AlarmHandler injects core/a.ts#ClockService',
      'ui/bell.ts#BellHandler injects ui/b.ts#ClockService',
    ]);
  });

  it('prefers a declaration in the same file, and leaves a shared name it cannot place unlinked', () => {
    const map = mapOf(
      {},
      file('core/a.ts', [decl('ClockService'), decl('AlarmHandler', [ref('ClockService')])]),
      file('ui/b.ts', [decl('ClockService')]),
      file('ui/c.ts', [decl('BellHandler', [ref('ClockService')])]),
    );
    assert.deepEqual(linksOf(map), ['core/a.ts#AlarmHandler injects core/a.ts#ClockService']);
  });

  it('never links a name imported from a package to a project class sharing it', () => {
    const map = mapOf(
      {},
      file('core/router.ts', [decl('Router')]),
      file('ui/a.ts', [decl('AlarmHandler', [ref('Router')])], {
        imports: [{ local: 'Router', imported: 'Router', module: '@angular/router' }],
      }),
    );
    assert.deepEqual(map.edges, []);
  });

  it('links a provider binding from the token to what it hands out', () => {
    const map = mapOf(
      {},
      file(
        'core/a.ts',
        [decl('CLOCK_SOURCE', [], { sort: 'InjectionToken' }), decl('QuartzSource')],
        {
          bindings: [{ token: 'CLOCK_SOURCE', target: 'QuartzSource' }],
        },
      ),
    );
    assert.deepEqual(linksOf(map), ['core/a.ts#CLOCK_SOURCE provides core/a.ts#QuartzSource']);
  });

  it('links a template tag to the one component whose selector claims it', () => {
    const map = mapOf(
      {},
      file('ui/face.ts', [component('FaceComponent', { tags: ['app-dial', 'app-twin'] })]),
      file('ui/dial.ts', [component('DialComponent', { element: 'app-dial' })]),
      file('ui/twin-a.ts', [component('TwinA', { element: 'app-twin' })]),
      file('ui/twin-b.ts', [component('TwinB', { element: 'app-twin' })]),
    );
    assert.deepEqual(linksOf(map), ['ui/face.ts#FaceComponent uses ui/dial.ts#DialComponent']);
  });
});

describe('architectureMap: windows', () => {
  const shell = file('app.ts', [component('ShellComponent')], {
    caseRoutes: [
      { label: 'wall', path: 'face' },
      { label: 'pocket', path: 'alarms' },
      { label: 'not-a-window', path: 'face' },
    ],
  });
  const routes = file('app.routes.ts', [], {
    routes: [
      { path: 'face', component: { name: 'FaceComponent', module: './ui/face' }, children: null },
      { path: 'alarms', component: null, children: './alarms/alarm.routes' },
    ],
  });
  const alarmRoutes = file('alarms/alarm.routes.ts', [], {
    routes: [{ path: '', component: { name: 'AlarmList', module: null }, children: null }],
    imports: [{ local: 'AlarmList', imported: 'AlarmList', module: './alarm-list' }],
  });
  const map = mapOf(
    { windows: ['wall', 'pocket', 'background'] },
    shell,
    routes,
    alarmRoutes,
    file('alarms/alarm-list.ts', [component('AlarmList', { tags: ['app-dial'] })]),
    file('ui/face.ts', [component('FaceComponent', { tags: ['app-dial'] })]),
    file('ui/dial.ts', [component('DialComponent', { element: 'app-dial' }), decl('Lonely')]),
    file('core/clock.ts', [decl('ClockService')]),
  );
  const windowsOf = (name: string) => map.nodes.find((node) => node.name === name)?.windows;

  it('hosts a window’s routed component and everything it reaches', () => {
    assert.deepEqual(windowsOf('FaceComponent'), ['wall']);
    assert.deepEqual(windowsOf('AlarmList'), ['pocket']);
    assert.deepEqual(windowsOf('DialComponent'), ['wall', 'pocket']);
  });

  it('leaves the shell and anything no window reaches unhosted', () => {
    assert.deepEqual(windowsOf('ShellComponent'), []);
    assert.deepEqual(windowsOf('Lonely'), []);
  });

  it('keeps every manifest window, hosting or not', () => {
    assert.deepEqual(map.windows, ['wall', 'pocket', 'background']);
  });
});
