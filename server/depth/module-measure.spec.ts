import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { measureModule } from './module-measure.ts';

const measure = (text: string) => measureModule('module.ts', text);

describe('implementation', () => {
  it('counts the work, not the lines, so comments and layout cannot move it', () => {
    const tight = `export function total(a: number[]) { let sum = 0; for (const n of a) sum += n; return sum; }`;
    const spread = `
      // Adds them up.
      export function total(
        a: number[],
      ) {

        let sum = 0;
        /* each one */
        for (const n of a) {
          sum += n;
        }

        return sum;
      }`;

    assert.deepEqual(measure(spread), measure(tight));
    assert.equal(measure(tight)?.implementation, 4);
  });

  it('leaves out imports, re-exports and type declarations, which run nothing', () => {
    const result = measure(`
      import { a } from './a';
      export interface Shape { readonly side: number }
      export type Id = string;
      export { a };
      export const ZERO = 0;`);

    assert.equal(result?.implementation, 1);
  });

  it('counts a function once whether it is declared or bound to a name', () => {
    const declared = measure(`export function twice(x: number) { return x * 2; }`);
    const bound = measure(`export const twice = (x: number) => x * 2;`);

    assert.deepEqual(declared, bound);
  });

  it('counts methods, initialised fields and the statements inside them', () => {
    const result = measure(`
      export class Counter {
        count = 0;
        label: string;
        increment() { this.count++; return this.count; }
      }`);

    assert.equal(result?.implementation, 4);
  });
});

describe('interface', () => {
  it('counts each exported name and the parameters a caller supplies', () => {
    const result = measure(`
      export function area(width: number, height: number) { return width * height; }
      export const ORIGIN = 0;
      export const scale = (factor: number) => factor;`);

    assert.equal(result?.interfaceSize, 3 + 1 + 2);
  });

  it('counts the public members of an exported class but not private, protected or #private ones', () => {
    const result = measure(`
      export class Clock {
        readonly zone = 'UTC';
        private ticks = 0;
        protected skew = 0;
        #secret = 1;
        now(format: string) { return format; }
        private reset() { this.ticks = 0; }
      }`);

    assert.equal(result?.interfaceSize, 1 + 1 + 2);
  });

  it('counts a get and set pair as one member', () => {
    const result = measure(`
      export class Box {
        private value = 0;
        get size() { return this.value; }
        set size(next: number) { this.value = next; }
      }`);

    assert.equal(result?.interfaceSize, 2);
  });

  it('charges a plain class for its constructor but not one the injector builds', () => {
    const plain = measure(
      `export class Plain { constructor(a: string, b: string) { void a; void b; } }`,
    );
    const injected = measure(
      `@Injectable() export class Injected { constructor(a: string, b: string) { void a; void b; } }`,
    );

    assert.equal(plain?.interfaceSize, 3);
    assert.equal(injected?.interfaceSize, 1);
  });

  it('counts the fields of an exported interface or object type as things to learn', () => {
    const result = measure(`
      export interface Reader { read(path: string): string; readonly root: string }
      export type Options = { retries: number; wait: number };
      export const reader = 0;`);

    assert.equal(result?.interfaceSize, 1 + (1 + 1) + 1 + 1 + 2 + 1);
  });

  it('counts each name of a barrel, and a star re-export as one', () => {
    const result = measure(`
      export { first, second } from './pair';
      export * from './rest';`);

    assert.deepEqual(result, { implementation: 0, interfaceSize: 3 });
  });
});

describe('what is not a module', () => {
  it('is null for a file that exports nothing: nothing else calls it', () => {
    assert.equal(measure(`bootstrap(App).catch(console.error);`), null);
  });

  it('is null for a file that exports only types: it does no work and hides none', () => {
    assert.equal(measure(`export interface A { a: string } export type B = A | null;`), null);
    assert.equal(measure(`interface A { a: string } export { A };`), null);
    assert.equal(measure(`export type { A } from './a';`), null);
  });

  it('reads a file with a syntax error rather than throwing', () => {
    assert.ok(measure(`export function broken( { return`));
  });
});
