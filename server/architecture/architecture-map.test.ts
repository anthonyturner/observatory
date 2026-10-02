import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { AreaRule } from './area-rules.ts';
import { architectureMap, type ScannedFile } from './architecture-map.ts';
import type { ScannedClass, ScannedInjection } from './source-scan.ts';

const RULES: readonly AreaRule[] = [
  { id: 'core', label: 'Core', root: 'core' },
  { id: 'ui', label: 'Interface', root: '' },
];

const injection = (
  target: string,
  members: string[] = [],
  how: ScannedInjection['how'] = 'inject',
): ScannedInjection => ({ target, how, members });

const klass = (
  name: string,
  injections: ScannedInjection[] = [],
  decorator: ScannedClass['decorator'] = 'Injectable',
): ScannedClass => ({ name, decorator, providedIn: null, injections });

const file = (path: string, ...classes: ScannedClass[]): ScannedFile => ({ file: path, classes });

const mapOf = (rules: readonly AreaRule[], ...files: ScannedFile[]) =>
  architectureMap({
    project: 'clockwork',
    scannedAt: '2026-10-01T00:00:00Z',
    windows: [],
    rules,
    files,
  });

describe('architectureMap', () => {
  it('names each kind from the decorator and the class name', () => {
    const map = mapOf(
      RULES,
      file(
        'core/all.ts',
        klass('AlarmHandler'),
        klass('TickStore'),
        klass('ClockService'),
        klass('DialComponent', [], 'Component'),
      ),
    );
    assert.deepEqual(
      map.nodes.map(({ name, kind }) => [name, kind]),
      [
        ['AlarmHandler', 'handler'],
        ['TickStore', 'store'],
        ['ClockService', 'service'],
        ['DialComponent', 'component'],
      ],
    );
  });

  it('places each node by its file', () => {
    const map = mapOf(RULES, file('core/time/clock.ts', klass('ClockService')));
    assert.deepEqual(
      [map.nodes[0]?.area, map.nodes[0]?.group, map.nodes[0]?.file],
      ['core', 'time', 'core/time/clock.ts'],
    );
  });

  it('drops injections of unknown targets and of the class itself', () => {
    const map = mapOf(
      RULES,
      file('core/a.ts', klass('ClockService', [injection('ClockService'), injection('Router')])),
    );
    assert.deepEqual(map.edges, []);
  });

  it('keeps one edge per target, merging members however often it is injected', () => {
    const map = mapOf(
      RULES,
      file(
        'core/a.ts',
        klass('AlarmHandler', [
          injection('ClockService', ['now', 'zone']),
          injection('ClockService', ['now', 'alarm'], 'constructor'),
        ]),
        klass('ClockService'),
      ),
    );
    assert.deepEqual(map.edges, [
      {
        from: 'AlarmHandler',
        to: 'ClockService',
        how: 'inject',
        members: ['alarm', 'now', 'zone'],
      },
    ]);
  });

  it('drops a second class of the same name along with its injections', () => {
    const map = mapOf(
      RULES,
      file('core/a.ts', klass('ClockService'), klass('TickStore')),
      file('ui/b.ts', klass('ClockService', [injection('TickStore')])),
    );
    assert.equal(map.nodes.filter(({ name }) => name === 'ClockService').length, 1);
    assert.deepEqual(map.edges, []);
  });

  it('skips files that no rule holds', () => {
    const map = mapOf(
      [{ id: 'core', label: 'Core', root: 'core' }],
      file('elsewhere/a.ts', klass('ClockService')),
    );
    assert.deepEqual(map.nodes, []);
  });

  it('lists the areas without their roots', () => {
    assert.deepEqual(mapOf(RULES).areas, [
      { id: 'core', label: 'Core' },
      { id: 'ui', label: 'Interface' },
    ]);
  });
});
