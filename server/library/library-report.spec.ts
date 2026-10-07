import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { type LibrarySources, libraryReport } from './library-report.ts';

const NOW = Date.parse('2026-10-07T12:00:00Z');

function sources(wiki: Record<string, string>, files: Record<string, string>): LibrarySources {
  return {
    wikiPage: async (_repo, page) => wiki[page] ?? null,
    defaultBranch: async () => 'trunk',
    filePaths: async () => [...Object.keys(files), 'docs/images/a.png'],
    fileText: async (_repo, path) => files[path] ?? null,
  };
}

describe('libraryReport', () => {
  it('reads the wiki when it has a Home page', async () => {
    const report = await libraryReport(
      sources({ Home: 'Welcome' }, { 'README.md': '# App' }),
      'me/app',
      NOW,
    );

    assert.equal(report.source, 'wiki');
    assert.equal(report.url, 'https://github.com/me/app/wiki');
    assert.deepEqual(
      report.pages.map((page) => page.slug),
      ['Home'],
    );
    assert.equal(report.generatedAt, '2026-10-07T12:00:00.000Z');
  });

  it('falls back to the README and docs on the default branch', async () => {
    const report = await libraryReport(
      sources({}, { 'docs/rules.md': '# Rules', 'README.md': '# App', 'src/a.ts': '' }),
      'me/app',
      NOW,
    );

    assert.equal(report.source, 'docs');
    assert.equal(report.url, 'https://github.com/me/app/tree/trunk/docs');
    assert.deepEqual(
      report.pages.map((page) => [page.slug, page.title]),
      [
        ['README', 'App'],
        ['docs/rules', 'Rules'],
      ],
    );
    assert.equal(report.isTruncated, false);
  });

  it('says there is nothing to read when there is neither', async () => {
    const report = await libraryReport(sources({}, { 'src/a.ts': '' }), 'me/app', NOW);

    assert.equal(report.source, 'none');
    assert.deepEqual(report.pages, []);
  });
});
