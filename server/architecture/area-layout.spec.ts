import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { areaLayoutOf } from './area-layout.ts';
import type { ArchitectureRuntime } from './architecture-types.ts';

const browser: ArchitectureRuntime = {
  id: 'browser',
  label: 'Browser app',
  kind: 'browser',
  root: 'src/app',
};

const layoutOf = (...files: string[]) => areaLayoutOf(browser, files);

describe('areaLayoutOf: top folders', () => {
  it('makes each top folder an area, and the folder below it a group', () => {
    const layout = layoutOf('src/app/queue/a.ts', 'src/app/queue/tools/b.ts', 'src/app/mail/c.ts');
    assert.deepEqual(layout.placeOf('src/app/queue/a.ts'), { area: 'browser:queue', group: '' });
    assert.deepEqual(layout.placeOf('src/app/queue/tools/b.ts'), {
      area: 'browser:queue',
      group: 'tools',
    });
    assert.deepEqual(layout.areas, [
      { id: 'browser:mail', label: 'Mail', runtime: 'browser', folder: 'src/app/mail' },
      { id: 'browser:queue', label: 'Queue', runtime: 'browser', folder: 'src/app/queue' },
    ]);
  });

  it('gathers files directly in the root into a shell area', () => {
    const layout = layoutOf('src/app/app.ts', 'src/app/queue/a.ts');
    assert.deepEqual(layout.placeOf('src/app/app.ts'), { area: 'browser:.', group: '' });
    assert.deepEqual(layout.areas[0], {
      id: 'browser:.',
      label: 'Shell',
      runtime: 'browser',
      folder: 'src/app',
    });
  });

  it('words a hyphenated folder as a label', () => {
    const [area] = layoutOf('src/app/agent-speech/a.ts').areas;
    assert.equal(area?.label, 'Agent speech');
  });
});

describe('areaLayoutOf: layers', () => {
  const layered = [
    'src/app/core/queue/a.ts',
    'src/app/core/queue/deep/b.ts',
    'src/app/core/mail/c.ts',
    'src/app/core/sky/d.ts',
    'src/app/core/index.ts',
    'src/app/features/queue/e.ts',
  ];

  it('splits a folder of three or more subfolders into one area per subfolder', () => {
    const layout = layoutOf(...layered);
    assert.deepEqual(layout.placeOf('src/app/core/queue/a.ts'), {
      area: 'browser:core/queue',
      group: '',
    });
    assert.deepEqual(layout.placeOf('src/app/core/queue/deep/b.ts'), {
      area: 'browser:core/queue',
      group: 'deep',
    });
  });

  it('keeps a layer’s own loose files in an area named for the layer', () => {
    const layout = layoutOf(...layered);
    assert.deepEqual(layout.placeOf('src/app/core/index.ts'), { area: 'browser:core', group: '' });
  });

  it('tells apart two areas of one name by their layer', () => {
    const labels = layoutOf(
      ...layered,
      'src/app/features/a/x.ts',
      'src/app/features/b/y.ts',
      'src/app/features/c/z.ts',
    )
      .areas.filter(({ id }) => id.endsWith('/queue'))
      .map(({ label }) => label);
    assert.deepEqual(labels, ['Queue (core)', 'Queue (features)']);
  });

  it('does not split a folder with fewer subfolders, or with more loose files than subfolders', () => {
    const feature = layoutOf(
      'src/app/queue/a.ts',
      'src/app/queue/tools/b.ts',
      'src/app/queue/data/c.ts',
    );
    assert.equal(feature.placeOf('src/app/queue/tools/b.ts').area, 'browser:queue');
    const busy = layoutOf(
      'src/app/queue/1.ts',
      'src/app/queue/2.ts',
      'src/app/queue/3.ts',
      'src/app/queue/x/a.ts',
      'src/app/queue/y/b.ts',
      'src/app/queue/z/c.ts',
    );
    assert.equal(busy.placeOf('src/app/queue/x/a.ts').area, 'browser:queue');
  });
});

describe('areaLayoutOf: a server root', () => {
  it('names areas for their own runtime', () => {
    const server: ArchitectureRuntime = {
      id: 'server',
      label: 'API server',
      kind: 'server',
      root: 'server',
    };
    const layout = areaLayoutOf(server, ['server/main.ts', 'server/queue/a.ts']);
    assert.deepEqual(
      layout.areas.map(({ id, folder }) => [id, folder]),
      [
        ['server:.', 'server'],
        ['server:queue', 'server/queue'],
      ],
    );
  });
});

describe('areaLayoutOf: a browser source root with an app folder', () => {
  const sourceRoot: ArchitectureRuntime = { ...browser, root: 'src' };
  const files = [
    'src/main.ts',
    'src/app/app.ts',
    'src/app/core/a.ts',
    'src/ui/panel/b.ts',
    'src/domain/c.ts',
  ];

  it('divides the app folder as if its contents sat in the root', () => {
    const layout = areaLayoutOf(sourceRoot, files);
    assert.equal(layout.placeOf('src/app/app.ts').area, 'browser:.');
    assert.equal(layout.placeOf('src/main.ts').area, 'browser:.');
    assert.equal(layout.placeOf('src/app/core/a.ts').area, 'browser:core');
  });

  it('keeps the folders beside the app folder as areas, each at its real folder', () => {
    const folders = areaLayoutOf(sourceRoot, files).areas.map(({ id, folder }) => [id, folder]);
    assert.deepEqual(folders, [
      ['browser:.', 'src'],
      ['browser:core', 'src/app/core'],
      ['browser:domain', 'src/domain'],
      ['browser:ui', 'src/ui'],
    ]);
  });

  it('does not lift an app folder out of a server root', () => {
    const server: ArchitectureRuntime = {
      id: 'server',
      label: 'API',
      kind: 'server',
      root: 'server',
    };
    const layout = areaLayoutOf(server, ['server/app/a.ts']);
    assert.equal(layout.placeOf('server/app/a.ts').area, 'server:app');
  });
});
