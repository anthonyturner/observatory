import assert from 'node:assert/strict';
import { rmSync } from 'node:fs';
import { after, describe, it } from 'node:test';
import type { CloneFinder } from '../collisions/clone-finder.ts';
import { NotFound } from '../http/api-handler.ts';
import { readOnlyGit } from '../live-agents/read-only-git.ts';
import { git, tempDir, write } from '../live-agents/testing/temp-repo.ts';
import { depthAnalyser, depthReports } from './depth-report.ts';
import { measureModule } from './module-measure.ts';
import type { SourceTree } from './source-tree.ts';

const DEEP = `export function run(x: number) { let y = x; y += 1; y += 2; y += 3; y += 4; return y; }`;
const SHALLOW = `export function run(x: number) { return other(x); }`;

function memoryTree(files: Record<string, string>): SourceTree {
  return {
    files: async () => Object.keys(files),
    read: async (path) => files[path] ?? null,
  };
}

describe('depthAnalyser', () => {
  it('judges each module and says where it lives', async () => {
    const analyse = depthAnalyser(memoryTree({ 'src/deep.ts': DEEP, 'top.ts': SHALLOW }));

    const modules = await analyse();

    assert.deepEqual(
      modules.map(({ file, folder, verdict }) => [file, folder, verdict]),
      [
        ['src/deep.ts', 'src', 'balanced'],
        ['top.ts', '', 'shallow'],
      ],
    );
  });

  it('leaves out specs, declaration files, test helpers and files that are not modules', async () => {
    const analyse = depthAnalyser(
      memoryTree({
        'a.ts': DEEP,
        'a.spec.ts': DEEP,
        'types.d.ts': DEEP,
        'testing/helper.ts': DEEP,
        'main.ts': 'start();',
        'shapes.ts': 'export interface A { a: string }',
      }),
    );

    assert.deepEqual(
      (await analyse()).map(({ file }) => file),
      ['a.ts'],
    );
  });

  it('skips a file git listed that has since been deleted', async () => {
    const tree: SourceTree = {
      files: async () => ['gone.ts', 'here.ts'],
      read: async (path) => (path === 'here.ts' ? DEEP : null),
    };

    assert.deepEqual(
      (await depthAnalyser(tree)()).map(({ file }) => file),
      ['here.ts'],
    );
  });

  it('measures a file again when it comes back after being deleted, not from a stale memory', async () => {
    const files: Record<string, string> = { 'a.ts': DEEP };
    const measured: string[] = [];
    const analyse = depthAnalyser(memoryTree(files), (name, text) => {
      measured.push(name);
      return measureModule(name, text);
    });

    await analyse();
    delete files['a.ts'];
    await analyse();
    files['a.ts'] = DEEP;
    await analyse();

    assert.deepEqual(measured, ['a.ts', 'a.ts']);
  });

  it('measures only the files whose text changed since the last read', async () => {
    const files: Record<string, string> = { 'a.ts': DEEP, 'b.ts': SHALLOW };
    const measured: string[] = [];
    const analyse = depthAnalyser(memoryTree(files), (name, text) => {
      measured.push(name);
      return measureModule(name, text);
    });

    await analyse();
    await analyse();
    files['b.ts'] = DEEP;
    const after = await analyse();

    assert.deepEqual(measured, ['a.ts', 'b.ts', 'b.ts']);
    assert.equal(after.find(({ file }) => file === 'b.ts')?.verdict, 'balanced');
  });
});

describe('depthReports', () => {
  const dir = tempDir('depth');
  git(dir, 'init', '--quiet');
  write(dir, '.gitignore', 'node_modules/\n');
  write(dir, 'src/deep.ts', DEEP);
  write(dir, 'src/wrapper.ts', SHALLOW);
  write(dir, 'node_modules/pkg/index.ts', DEEP);
  git(dir, 'add', '-A');
  write(dir, 'src/untracked.ts', DEEP);
  after(() => rmSync(dir, { recursive: true, force: true }));

  let now = Date.parse('2026-10-08T12:00:00Z');
  const clones: CloneFinder = { cloneOf: async (repo) => (repo === 'me/app' ? dir : null) };
  const reports = depthReports(clones, readOnlyGit(), () => now);

  it('reads the clone through git: tracked and new files in, ignored ones out', async () => {
    const report = await reports.read('me/app');

    assert.deepEqual(
      report.modules.map(({ file }) => file),
      ['src/deep.ts', 'src/untracked.ts', 'src/wrapper.ts'],
    );
    assert.equal(report.repo, 'me/app');
    assert.equal(report.scannedAt, '2026-10-08T12:00:00.000Z');
  });

  it('carries the principles its verdicts name, by their ids in the principles deck', async () => {
    const { principles } = await reports.read('me/app');

    assert.deepEqual(
      principles.map(({ id }) => id),
      ['deep-modules', 'shallow-modules'],
    );
    assert.ok(principles.every(({ title, idea }) => title && idea));
  });

  it('keeps an answer for a while, and reads again once forgotten', async () => {
    write(dir, 'src/later.ts', DEEP);
    now += 1_000;
    assert.equal((await reports.read('me/app')).modules.length, 3);

    reports.forget('me/app');
    assert.equal((await reports.read('me/app')).modules.length, 4);
  });

  it('reads again once the answer is old', async () => {
    write(dir, 'src/older.ts', DEEP);
    now += 60_000;

    assert.equal((await reports.read('me/app')).modules.length, 5);
  });

  it('is not found when this machine has no clone of the repository', async () => {
    await assert.rejects(reports.read('me/other'), NotFound);
  });
});
