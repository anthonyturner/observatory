import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { scanSource } from './source-scan.ts';

const scan = (text: string) => scanSource('clock.ts', text);

const only = (text: string) => {
  const [found] = scan(text);
  assert.ok(found);
  return found;
};

describe('scanSource', () => {
  it('reads the decorator and providedIn of an injectable class', () => {
    const found = only(`@Injectable({ providedIn: 'root' }) export class ClockService {}`);
    assert.equal(found.name, 'ClockService');
    assert.equal(found.decorator, 'Injectable');
    assert.equal(found.providedIn, 'root');
  });

  it('returns components and directives with their own decorator and no providedIn', () => {
    const found = scan(`
      @Component({ selector: 'app-dial' }) export class DialComponent {}
      @Directive({ selector: '[tick]' }) export class TickDirective {}
    `);
    assert.deepEqual(
      found.map(({ name, decorator, providedIn }) => [name, decorator, providedIn]),
      [
        ['DialComponent', 'Component', null],
        ['TickDirective', 'Directive', null],
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
    assert.deepEqual(found.injections, [
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
    assert.deepEqual(found.injections, [
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
    assert.deepEqual(found.injections[0]?.members, ['now']);
  });

  it('gives an inject() inside a constructor body an edge with no members', () => {
    const found = only(`
      @Injectable() export class AlarmHandler {
        constructor() { const clock = inject(ClockService); clock.now(); }
      }
    `);
    assert.deepEqual(found.injections, [{ target: 'ClockService', how: 'inject', members: [] }]);
  });

  it('reads constructor parameters, tracking members only for those with a modifier', () => {
    const found = only(`
      @Injectable() export class AlarmHandler {
        constructor(private clock: ClockService, tick: TickStore) {}
        run() { this.clock.now(); this.tick.ticks; }
      }
    `);
    assert.deepEqual(found.injections, [
      { target: 'ClockService', how: 'constructor', members: ['now'] },
      { target: 'TickStore', how: 'constructor', members: [] },
    ]);
  });
});
