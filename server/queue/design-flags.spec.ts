import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { type DesignFlag, MAX_FLAGS, designFlagsOf } from './design-flags.ts';

/** A diff adding `lines` to a new file at `path`, from line 1. */
function added(path: string, lines: readonly string[]): string {
  return [
    `diff --git a/${path} b/${path}`,
    'new file mode 100644',
    '--- /dev/null',
    `+++ b/${path}`,
    `@@ -0,0 +1,${lines.length} @@`,
    ...lines.map((line) => `+${line}`),
    '',
  ].join('\n');
}

const flagsIn = (lines: readonly string[], path = 'src/app/thing.ts'): DesignFlag[] =>
  designFlagsOf(added(path, lines));

const kindsAt = (flags: readonly DesignFlag[]): string[] =>
  flags.map((flag) => `${flag.kind}@${flag.line}`);

describe('designFlagsOf: a catch that discards the error', () => {
  it('flags an empty catch block, even one holding only a comment', () => {
    const flags = flagsIn([
      'try {',
      '  run();',
      '} catch (error) {',
      '  // nothing to do',
      '}',
      'try { run(); } catch {}',
    ]);
    assert.deepEqual(kindsAt(flags), ['swallowed-error@3', 'swallowed-error@6']);
    assert.equal(flags[0].note, 'empty catch');
    assert.equal(flags[0].path, 'src/app/thing.ts');
    assert.equal(flags[0].excerpt, '} catch (error) {');
  });

  it('flags a named error the block never uses', () => {
    const flags = flagsIn(['try {', '  run();', '} catch (e: unknown) {', '  return null;', '}']);
    assert.deepEqual(kindsAt(flags), ['swallowed-error@3']);
    assert.equal(flags[0].note, 'error `e` is never used');
  });

  it('passes a catch that logs, rethrows or wraps its error', () => {
    const flags = flagsIn([
      'try { run(); } catch (error) { log(error); }',
      'try { run(); } catch (e) { throw new Failed("run", { cause: e }); }',
      'try { run(); } catch (err) {',
      '  if (err instanceof Gone) return;',
      '  throw err;',
      '}',
    ]);
    assert.deepEqual(flags, []);
  });

  it('passes a catch with no name for the error and a fallback: dropping it was chosen', () => {
    assert.deepEqual(flagsIn(['try { return JSON.parse(text); } catch { return null; }']), []);
  });

  it('flags a promise handler that is empty or ignores its error', () => {
    const flags = flagsIn([
      'load().catch(() => {});',
      'load().catch(() => undefined);',
      'load().catch((error) => fallback());',
      'load().catch(noop);',
    ]);
    assert.deepEqual(kindsAt(flags), [
      'swallowed-error@1',
      'swallowed-error@2',
      'swallowed-error@3',
      'swallowed-error@4',
    ]);
  });

  it('passes a promise handler that uses its error or returns a fallback', () => {
    const flags = flagsIn([
      "load().catch(() => '');",
      'load().catch((error: unknown) => console.error(error));',
      'load().catch(function (e) { report(e); });',
      'load().catch(report);',
    ]);
    assert.deepEqual(flags, []);
  });

  it('is not fooled by braces or the word catch inside strings', () => {
    assert.deepEqual(flagsIn(["const text = 'try { } catch (e) { }';"]), []);
  });

  it('passes over a block whose end lies outside the diff', () => {
    assert.deepEqual(flagsIn(['try {', '  run();', '} catch (e) {', '  e.toString();']), []);
  });
});

describe('designFlagsOf: a TODO with no issue', () => {
  it('flags TODO, FIXME, HACK and XXX in comments without a reference', () => {
    const flags = flagsIn([
      '// TODO: clean up later',
      'run(); /* FIXME this leaks */',
      '/**',
      ' * HACK around the cache',
      ' */',
      '// XXX',
    ]);
    assert.deepEqual(kindsAt(flags), [
      'untracked-todo@1',
      'untracked-todo@2',
      'untracked-todo@4',
      'untracked-todo@6',
    ]);
    assert.equal(flags[0].note, 'TODO with no issue');
  });

  it('passes one that names its issue, and the word in a string or a name', () => {
    const flags = flagsIn([
      '// TODO(#412): drop once GitHub fixes the header',
      '// FIXME see https://github.com/o/r/issues/9',
      '// HACK: OBS-42',
      "const label = 'TODO list';",
      'const todos = [];',
    ]);
    assert.deepEqual(flags, []);
  });
});

describe('designFlagsOf: a method that only forwards', () => {
  it('flags a method, a function and an arrow that pass their arguments straight on to a namesake', () => {
    const flags = flagsIn([
      'class Reads {',
      '  read(repo: string, number: number): Promise<Pull> {',
      '    return this.store.read(repo, number);',
      '  }',
      '}',
      'export async function load(key) { return await cache.load(key); }',
      'const labels = (repo: string) => github.labels(repo);',
      'const api = {',
      '  forget: (repo) => reads.forget(repo),',
      '};',
    ]);
    assert.deepEqual(kindsAt(flags), [
      'pass-through@2',
      'pass-through@6',
      'pass-through@7',
      'pass-through@9',
    ]);
    assert.equal(flags[0].note, '`read` only forwards to `this.store.read`');
  });

  it('passes a method that changes, adds to or reorders what it passes', () => {
    const flags = flagsIn([
      'read(repo, number) { return this.store.read(`${repo}#${number}`); }',
      'read(repo, number) { return this.store.read(number, repo); }',
      'read(repo) { return this.store.read(repo, LIMIT); }',
      'read(repo) { return this.store.read(repo).then(parse); }',
      'items.map((item) => format.line(item));',
      'size() { return this.items.size(); }',
      'if (ready) { return queue.flush(ready); }',
    ]);
    assert.deepEqual(flags, []);
  });

  it('passes a call to a method of another name, and a callback that binds its own method', () => {
    const flags = flagsIn([
      'export const isAbsolute = (target: string): boolean => ABSOLUTE.test(target);',
      'const loop = { draw: (time, wall) => this.draw(time, wall) };',
      'actions: (repo) => actionsOf.read(repo),',
    ]);
    assert.deepEqual(flags, []);
  });
});

describe('designFlagsOf: a check switched off', () => {
  it('flags an eslint-disable with no reason, @ts-ignore and @ts-nocheck', () => {
    const flags = flagsIn([
      '// eslint-disable-next-line @typescript-eslint/no-explicit-any',
      'const x = y; // @ts-ignore',
      '/* eslint-disable */',
      '// @ts-nocheck',
    ]);
    assert.deepEqual(kindsAt(flags), [
      'silenced-check@1',
      'silenced-check@2',
      'silenced-check@3',
      'silenced-check@4',
    ]);
  });

  it('passes an eslint-disable that gives its reason, and @ts-expect-error', () => {
    const flags = flagsIn([
      '// eslint-disable-next-line no-console -- the CLI prints to the terminal',
      '// @ts-expect-error: testing a bad input',
    ]);
    assert.deepEqual(flags, []);
  });
});

describe('designFlagsOf: what it reads', () => {
  it('reads only added lines, numbered as the new file has them', () => {
    const diff = [
      'diff --git a/src/a.ts b/src/a.ts',
      '--- a/src/a.ts',
      '+++ b/src/a.ts',
      '@@ -10,4 +20,4 @@ class A {',
      ' // TODO: already here',
      '-// TODO: going away',
      '+// TODO: new',
      ' keep();',
      '-try { run(); } catch {}',
      '+try { run(); } catch (e) { log(e); }',
      '',
    ].join('\n');
    assert.deepEqual(kindsAt(designFlagsOf(diff)), ['untracked-todo@21']);
  });

  it('flags a catch whose body the change empties, when the catch line is added', () => {
    const diff = [
      'diff --git a/src/a.ts b/src/a.ts',
      '--- a/src/a.ts',
      '+++ b/src/a.ts',
      '@@ -1,3 +1,3 @@',
      ' try { run(); }',
      '+catch (e) {',
      '-catch (e) { log(e);',
      ' }',
      '',
    ].join('\n');
    assert.deepEqual(kindsAt(designFlagsOf(diff)), ['swallowed-error@2']);
  });

  it('skips tests, declarations, bundles, other languages and deleted files', () => {
    const todo = ['// TODO: later'];
    const deleted = [
      'diff --git a/src/gone.ts b/src/gone.ts',
      'deleted file mode 100644',
      '--- a/src/gone.ts',
      '+++ /dev/null',
      '@@ -1 +0,0 @@',
      '-// TODO: later',
      '',
    ].join('\n');
    const diff = [
      added('src/a.spec.ts', todo),
      added('test/helpers.ts', todo),
      added('src/types.d.ts', todo),
      added('vendor/lib.min.js', todo),
      added('scripts/build.py', ['# TODO: later']),
      deleted,
    ].join('');
    assert.deepEqual(designFlagsOf(diff), []);
  });

  it('reads JavaScript and TSX as well as TypeScript', () => {
    const diff = [
      added('a.js', ['// TODO']),
      added('b.tsx', ['// TODO']),
      added('c.mjs', ['// TODO']),
    ].join('');
    assert.deepEqual(
      designFlagsOf(diff).map((flag) => flag.path),
      ['a.js', 'b.tsx', 'c.mjs'],
    );
  });

  it('flags a line once for each kind, and stops at MAX_FLAGS', () => {
    const many = Array.from({ length: MAX_FLAGS + 20 }, () => '// TODO TODO');
    const flags = flagsIn(many);
    assert.equal(flags.length, MAX_FLAGS);
    assert.equal(new Set(flags.map((flag) => flag.line)).size, MAX_FLAGS);
  });

  it('gives nothing for an empty diff', () => {
    assert.deepEqual(designFlagsOf(''), []);
  });
});
