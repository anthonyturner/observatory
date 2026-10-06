import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { EdgeKind } from './architecture-types.ts';
import type { ScannedDeclaration } from './scanned-source.ts';
import { scanSource } from './source-scan.ts';

const scan = (text: string) => scanSource('clock.ts', text).declarations;

const only = (text: string): ScannedDeclaration => {
  const [found] = scan(text);
  assert.ok(found);
  return found;
};

const referencesOf = (found: ScannedDeclaration, kind: EdgeKind) =>
  found.references
    .filter((reference) => reference.kind === kind)
    .map(({ target, how, members }) => ({ target, how, members }));

const targetsOf = (found: ScannedDeclaration, kind: EdgeKind) =>
  referencesOf(found, kind).map(({ target }) => target);

describe('scanSource: classes', () => {
  it('reads the decorator and providedIn of an injectable class', () => {
    const found = only(`@Injectable({ providedIn: 'root' }) export class ClockService {}`);
    assert.equal(found.name, 'ClockService');
    assert.equal(found.sort, 'Injectable');
    assert.equal(found.providedIn, 'root');
  });

  it('returns components and directives with their own decorator and no providedIn', () => {
    const found = scan(`
      @Component({ selector: 'app-dial' }) export class DialComponent {}
      @Directive({ selector: '[tick]' }) export class TickDirective {}
    `);
    assert.deepEqual(
      found.map(({ name, sort, providedIn, element }) => [name, sort, providedIn, element]),
      [
        ['DialComponent', 'Component', null, 'app-dial'],
        ['TickDirective', 'Directive', null, null],
      ],
    );
  });

  it('ignores a class that carries no Angular decorator', () => {
    assert.deepEqual(scan(`export class PlainHelper { clock = inject(ClockService); }`), []);
  });

  it('finds a field inject() and the members read through that field', () => {
    const found = only(`
      @Injectable() export class AlarmHandler {
        private readonly clock = inject(ClockService);
        ring() { return this.clock.now() + this.clock.zone; }
      }
    `);
    assert.deepEqual(referencesOf(found, 'injects'), [
      { target: 'ClockService', how: 'inject', members: ['now', 'zone'] },
    ]);
  });

  it('sees through an inject() with options, an `as` cast and a non-null assertion', () => {
    const found = only(`
      @Injectable() export class AlarmHandler {
        a = inject(ClockService, { optional: true });
        b = inject(TickStore) as TickStore;
        c = inject(DialRegistry)!;
        run() { this.a.now; this.b.ticks; this.c.dials; }
      }
    `);
    assert.deepEqual(referencesOf(found, 'injects'), [
      { target: 'ClockService', how: 'inject', members: ['now'] },
      { target: 'TickStore', how: 'inject', members: ['ticks'] },
      { target: 'DialRegistry', how: 'inject', members: ['dials'] },
    ]);
  });

  it('counts optional-chained reads as member use', () => {
    const found = only(`
      @Injectable() export class AlarmHandler {
        clock = inject(ClockService);
        run() { return this.clock?.now(); }
      }
    `);
    assert.deepEqual(referencesOf(found, 'injects')[0]?.members, ['now']);
  });

  it('gives an inject() inside a constructor body an edge with no members', () => {
    const found = only(`
      @Injectable() export class AlarmHandler {
        constructor() { const clock = inject(ClockService); clock.now(); }
      }
    `);
    assert.deepEqual(referencesOf(found, 'injects'), [
      { target: 'ClockService', how: 'inject', members: [] },
    ]);
  });

  it('reads constructor parameters, tracking members only for those with a modifier', () => {
    const found = only(`
      @Injectable() export class AlarmHandler {
        constructor(private clock: ClockService, tick: TickStore) {}
        run() { this.clock.now(); this.tick.ticks; }
      }
    `);
    assert.deepEqual(referencesOf(found, 'injects'), [
      { target: 'ClockService', how: 'constructor', members: ['now'] },
      { target: 'TickStore', how: 'constructor', members: [] },
    ]);
  });

  it('reads the class a class extends', () => {
    const found = only(`@Component({}) export class WallClock extends BaseClock {}`);
    assert.deepEqual(targetsOf(found, 'extends'), ['BaseClock']);
  });

  it('reads the components a component imports as uses', () => {
    const found = only(`@Component({ imports: [DialComponent, HandsComponent] }) class Face {}`);
    assert.deepEqual(targetsOf(found, 'uses'), ['DialComponent', 'HandsComponent']);
  });

  it('reads the custom tags of an inline template and keeps a templateUrl to read later', () => {
    const found = only(`
      @Component({ template: '<app-dial /><div></div><app-hands></app-hands>' }) class Face {}
      `);
    assert.deepEqual(found.tags, ['app-dial', 'app-hands']);
    const linked = only(`@Component({ templateUrl: './face.html' }) class Face {}`);
    assert.equal(linked.templateUrl, './face.html');
  });

  it('records each function a class calls by name, but not inject itself', () => {
    const found = only(`
      @Component({}) class Face { fit = createFitter(); other = inject(Clock); x() { tick(); tick(); } }
    `);
    assert.deepEqual(targetsOf(found, 'calls'), ['Component', 'createFitter', 'tick']);
  });
});

describe('scanSource: providers', () => {
  it('reads plain entries, spreads and provider objects in a class providers list', () => {
    const scanned = scanSource(
      'face.ts',
      `@Component({ providers: [ClockService, ...TICK_PROVIDERS,
         { provide: CLOCK_SOURCE, useClass: QuartzSource, deps: [Crystal] }] }) class Face {}`,
    );
    const [face] = scanned.declarations;
    assert.ok(face);
    assert.deepEqual(targetsOf(face, 'provides'), [
      'ClockService',
      'TICK_PROVIDERS',
      'CLOCK_SOURCE',
      'QuartzSource',
      'Crystal',
    ]);
    assert.deepEqual(scanned.bindings, [
      { token: 'CLOCK_SOURCE', target: 'QuartzSource' },
      { token: 'CLOCK_SOURCE', target: 'Crystal' },
    ]);
  });

  it('maps a top-level provider array and an app config as provider lists', () => {
    const found = scan(`
      export const TICK_PROVIDERS: Provider[] = [TickStore];
      export const ALARM_PROVIDERS = [{ provide: ALARM, useExisting: Bell }];
      export const appConfig: ApplicationConfig = { providers: [provideClock(), ClockService] };
      export const NUMBERS = [1, 2, 3];
    `);
    assert.deepEqual(
      found.map(({ name, sort }) => [name, sort]),
      [
        ['TICK_PROVIDERS', 'providers'],
        ['ALARM_PROVIDERS', 'providers'],
        ['appConfig', 'providers'],
      ],
    );
    assert.deepEqual(found[2] && targetsOf(found[2], 'provides'), ['ClockService']);
  });
});

describe('scanSource: tokens and functions', () => {
  it('maps an injection token with what its factory injects', () => {
    const found = only(`
      export const CLOCK_SOURCE = new InjectionToken<Source>('source', {
        providedIn: 'root',
        factory: () => inject(QuartzSource),
      });
    `);
    assert.deepEqual(
      [found.name, found.sort, found.providedIn],
      ['CLOCK_SOURCE', 'InjectionToken', 'root'],
    );
    assert.deepEqual(referencesOf(found, 'injects'), [
      { target: 'QuartzSource', how: 'inject', members: [] },
    ]);
  });

  it('maps a plain function or arrow that calls inject(), and skips one that does not', () => {
    const found = scan(`
      export function createFitter(size: number) { return new Fitter(inject(ClockService), size); }
      export const injectTicker = () => inject(TickStore);
      export function plainMaths(a: number) { return a * 2; }
    `);
    assert.deepEqual(
      found.map((each) => [each.name, each.sort, targetsOf(each, 'injects')]),
      [
        ['createFitter', 'function', ['ClockService']],
        ['injectTicker', 'function', ['TickStore']],
      ],
    );
  });
});

describe('scanSource: imports', () => {
  it('lists named imports with their original names', () => {
    const { imports } = scanSource(
      'face.ts',
      `import { ClockService, TickStore as Ticks } from './clock';
       import * as everything from './all';
       import Default from './default';`,
    );
    assert.deepEqual(imports, [
      { local: 'ClockService', imported: 'ClockService', module: './clock' },
      { local: 'Ticks', imported: 'TickStore', module: './clock' },
    ]);
  });
});
