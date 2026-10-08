import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { importGraphOf } from './import-graph.ts';
import { scanSource } from './source-scan.ts';
import type { ScannedFile } from './scanned-source.ts';

const files = (sources: Readonly<Record<string, string>>): ScannedFile[] =>
  Object.entries(sources).map(([file, text]) => ({ ...scanSource(file, text), file }));

const graphOf = (sources: Readonly<Record<string, string>>) =>
  importGraphOf(files(sources), [{ prefix: '@/', target: 'src/' }]);

describe('importGraphOf: imports', () => {
  it('links files by relative path, alias, folder index and explicit extension', () => {
    const { imports } = graphOf({
      'src/a.ts': `import './b'; import { c } from '@/lib'; export * from './d.ts';`,
      'src/b.ts': '',
      'src/lib/index.ts': '',
      'src/d.ts': '',
    });
    assert.deepEqual(imports, [
      { from: 'src/a.ts', to: 'src/b.ts' },
      { from: 'src/a.ts', to: 'src/d.ts' },
      { from: 'src/a.ts', to: 'src/lib/index.ts' },
    ]);
  });

  it('leaves out packages, files that were not scanned, and a file importing itself', () => {
    const { imports } = graphOf({
      'src/a.ts': `import 'rxjs'; import './missing'; import './a';`,
    });
    assert.deepEqual(imports, []);
  });
});

describe('importGraphOf: cycles', () => {
  it('finds a cycle once, starting from its smallest path', () => {
    const { cycles } = graphOf({
      'src/b.ts': `import './c';`,
      'src/c.ts': `import './a';`,
      'src/a.ts': `import './b';`,
    });
    assert.deepEqual(cycles, [['src/a.ts', 'src/b.ts', 'src/c.ts']]);
  });

  it('gives each import on a cycle the shortest cycle through it', () => {
    const { cycles } = graphOf({
      'src/a.ts': `import './b'; import './c';`,
      'src/b.ts': `import './a';`,
      'src/c.ts': `import './b';`,
    });
    assert.deepEqual(cycles, [
      ['src/a.ts', 'src/b.ts'],
      ['src/a.ts', 'src/c.ts', 'src/b.ts'],
    ]);
  });

  it('finds none in a graph that only fans out', () => {
    const { cycles } = graphOf({
      'src/a.ts': `import './b'; import './c';`,
      'src/b.ts': `import './c';`,
      'src/c.ts': '',
    });
    assert.deepEqual(cycles, []);
  });
});
