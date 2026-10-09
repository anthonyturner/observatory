import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { wikiPages } from './wiki-pages.ts';

describe('wikiPages', () => {
  it('publishes the overview pages first, Home from the README and then the Guide', () => {
    const pages = wikiPages([]);

    assert.deepEqual(
      pages.map(({ source, name }) => [source, name]),
      [
        ['README.md', 'Home'],
        ['docs/guide.md', 'Guide'],
        ['docs/tech-stack.md', 'Tech-stack'],
        ['docs/sky-visuals.md', 'Sky-visuals'],
        ['CHANGELOG.md', 'Changelog'],
        ['docs/decisions/README.md', 'Decisions'],
      ],
    );
  });

  it('adds each decision record in number order under Decisions, titled by its heading', () => {
    const pages = wikiPages([
      { fileName: '0002-track-work.md', markdown: '# ADR-0002: Track work in GitHub only\n\nBody' },
      { fileName: '0001-record.md', markdown: 'No heading' },
      { fileName: '0000-template.md', markdown: '# ADR-NNNN: <title>' },
      { fileName: 'README.md', markdown: '# Index' },
    ]).slice(6);

    assert.deepEqual(pages, [
      {
        source: 'docs/decisions/0001-record.md',
        name: 'ADR-0001-record',
        title: 'ADR-0001-record',
        parent: 'Decisions',
      },
      {
        source: 'docs/decisions/0002-track-work.md',
        name: 'ADR-0002-track-work',
        title: 'ADR-0002: Track work in GitHub only',
        parent: 'Decisions',
      },
    ]);
  });
});
