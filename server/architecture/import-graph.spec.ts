import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { fixtureProject } from './fixture-project.testing.ts';
import { importGraphOf } from './import-graph.ts';

const graphOf = (sources: Readonly<Record<string, string>>) =>
  importGraphOf(
    fixtureProject(sources),
    Object.keys(sources).filter((file) => file.endsWith('.ts')),
  );

const TSCONFIG = JSON.stringify({
  compilerOptions: { baseUrl: '.', paths: { '@/*': ['src/*'] } },
});

describe('importGraphOf: imports', () => {
  it('links files by relative path, alias, folder index and explicit extension', async () => {
    const { imports } = await graphOf({
      'tsconfig.json': TSCONFIG,
      'src/a.ts': `import './b'; import { c } from '@/lib'; export * from './d.ts';`,
      'src/b.ts': 'export const b = 1;',
      'src/lib/index.ts': 'export const c = 1;',
      'src/d.ts': 'export const d = 1;',
    });
    assert.deepEqual(imports, [
      { from: 'src/a.ts', to: 'src/b.ts' },
      { from: 'src/a.ts', to: 'src/d.ts' },
      { from: 'src/a.ts', to: 'src/lib/index.ts' },
    ]);
  });

  it('leaves out packages, built-ins, missing files, tests and a file importing itself', async () => {
    const { imports } = await graphOf({
      'src/a.ts': `import 'rxjs'; import 'node:fs'; import './missing'; import './a'; import './a.spec';`,
      'src/a.spec.ts': 'export const t = 1;',
    });
    assert.deepEqual(imports, []);
  });
});

describe('importGraphOf: cycles', () => {
  it('finds a cycle once, starting from its smallest path', async () => {
    const { cycles } = await graphOf({
      'src/b.ts': `import './c';`,
      'src/c.ts': `import './a';`,
      'src/a.ts': `import './b';`,
    });
    assert.deepEqual(cycles, [['src/a.ts', 'src/b.ts', 'src/c.ts']]);
  });

  it('counts a cycle of type-only imports', async () => {
    const { cycles } = await graphOf({
      'src/a.ts': `import type { B } from './b'; export type A = B;`,
      'src/b.ts': `import type { A } from './a'; export type B = A;`,
    });
    assert.deepEqual(cycles, [['src/a.ts', 'src/b.ts']]);
  });

  it('finds none in a graph that only fans out', async () => {
    const { cycles } = await graphOf({
      'src/a.ts': `import './b'; import './c';`,
      'src/b.ts': `import './c';`,
      'src/c.ts': 'export const c = 1;',
    });
    assert.deepEqual(cycles, []);
  });
});

describe('importGraphOf: orphans', () => {
  it('lists the files that import nothing and that nothing imports', async () => {
    const { orphans } = await graphOf({
      'src/a.ts': `import './b';`,
      'src/b.ts': 'export const b = 1;',
      'src/lonely.ts': 'export const lonely = 1;',
    });
    assert.deepEqual(orphans, ['src/lonely.ts']);
  });
});
