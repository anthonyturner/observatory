import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { docPages, docPaths, docsUrl, humanized, shelfOf } from './docs-shelf.ts';

const ORIGIN = { repo: 'me/app', branch: 'main' };

describe('docPaths', () => {
  it('reads the README, then docs folder by folder, each folder’s index first', () => {
    const paths = [
      'src/app.ts',
      'docs/stack/angular.md',
      'docs/rules.md',
      'docs/decisions/0002-b.md',
      'docs/decisions/README.md',
      'docs/images/sky.png',
      'README.md',
      'CHANGELOG.md',
      'docs/decisions/0001-a.md',
    ];

    assert.deepEqual(docPaths(paths), [
      'README.md',
      'docs/rules.md',
      'docs/decisions/README.md',
      'docs/decisions/0001-a.md',
      'docs/decisions/0002-b.md',
      'docs/stack/angular.md',
    ]);
  });

  it('reads a README however it is cased, and nothing outside docs', () => {
    assert.deepEqual(docPaths(['Readme.md', 'notes/a.md', 'docsy/b.md']), ['Readme.md']);
  });
});

describe('shelfOf', () => {
  it('names the root, docs itself, and each folder inside it', () => {
    assert.equal(shelfOf('README.md'), 'Overview');
    assert.equal(shelfOf('docs/rules.md'), 'Docs');
    assert.equal(shelfOf('docs/agent-workflows/tracking.md'), 'Agent workflows');
    assert.equal(shelfOf('docs/stack/web_ui/a.md'), 'Stack / Web ui');
  });
});

describe('humanized', () => {
  it('turns a file name into words', () => {
    assert.equal(humanized('tech-stack'), 'Tech stack');
    assert.equal(humanized('README'), 'README');
  });
});

describe('docPages', () => {
  it('titles a page by its first heading, else its file name', () => {
    const [titled, untitled] = docPages(ORIGIN, [
      { path: 'docs/rules.md', markdown: 'Intro\n# The rules\n' },
      { path: 'docs/tech-stack.md', markdown: 'No heading' },
    ]);

    assert.equal(titled.title, 'The rules');
    assert.equal(untitled.title, 'Tech stack');
  });

  it('gives each page its path as a slug, its shelf and its GitHub address', () => {
    const [page] = docPages(ORIGIN, [{ path: 'docs/stack/angular.md', markdown: '' }]);

    assert.equal(page.slug, 'docs/stack/angular');
    assert.equal(page.shelf, 'Stack');
    assert.equal(page.url, 'https://github.com/me/app/blob/main/docs/stack/angular.md');
  });

  it('points links between pages into the Library, and the rest at GitHub', () => {
    const [readme] = docPages(ORIGIN, [
      {
        path: 'README.md',
        markdown:
          '[rules](docs/rules.md#one)\r\n![sky](docs/images/sky.png) [src](src/app.ts) [#](#top)',
      },
      { path: 'docs/rules.md', markdown: '' },
    ]);

    assert.equal(
      readme.markdown,
      '[rules](/p/me/app/library/docs/rules#one)\n' +
        '![sky](https://github.com/me/app/raw/main/docs/images/sky.png)' +
        ' [src](https://github.com/me/app/blob/main/src/app.ts) [#](#top)',
    );
  });
});

describe('docsUrl', () => {
  it('opens the docs folder where there is one, else the repository', () => {
    assert.equal(docsUrl(ORIGIN, ['docs/a.md']), 'https://github.com/me/app/tree/main/docs');
    assert.equal(docsUrl(ORIGIN, ['README.md']), 'https://github.com/me/app');
  });
});
