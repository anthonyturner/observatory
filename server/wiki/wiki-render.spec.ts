import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { WikiPage } from './wiki-pages.ts';
import { isGenerated, renderPage, renderSidebar } from './wiki-render.ts';

const REPO = { repoUrl: 'https://github.com/me/app', branch: 'main' };
const WIKI = `${REPO.repoUrl}/wiki`;
const STACK: WikiPage = { source: 'docs/tech-stack.md', name: 'Tech-stack', title: 'Tech stack' };

describe('renderPage', () => {
  it('opens with the marker and a banner naming the file to edit, then the rewritten text', () => {
    const page = renderPage(STACK, '# Tech stack\r\n\r\nSee [home](../README.md).\r\n\r\n', {
      ...REPO,
      source: STACK.source,
      pageBySource: new Map([['README.md', 'Home']]),
    });

    const lines = page.split('\n');
    assert.ok(isGenerated(page));
    assert.match(
      lines[1] ?? '',
      /Generated from \[`docs\/tech-stack.md`\]\(https:\/\/github.com\/me\/app\/blob\/main\/docs\/tech-stack.md\)/,
    );
    assert.match(lines[1] ?? '', /Edit it there/);
    assert.deepEqual(lines.slice(2), [
      '',
      '# Tech stack',
      '',
      'See [home](https://github.com/me/app/wiki/Home).',
      '',
    ]);
  });
});

describe('renderSidebar', () => {
  it('lists every page by title, children indented under their parent', () => {
    const sidebar = renderSidebar(
      [
        { source: 'README.md', name: 'Home', title: 'Home' },
        { source: 'docs/decisions/README.md', name: 'Decisions', title: 'Decisions' },
        {
          source: 'docs/decisions/0001-a.md',
          name: 'ADR-0001-a',
          title: 'ADR-0001: A',
          parent: 'Decisions',
        },
        STACK,
      ],
      REPO,
    );

    assert.ok(isGenerated(sidebar));
    assert.deepEqual(sidebar.split('\n').slice(1, 5), [
      `- [Home](${WIKI}/Home)`,
      `- [Decisions](${WIKI}/Decisions)`,
      `  - [ADR-0001: A](${WIKI}/ADR-0001-a)`,
      `- [Tech stack](${WIKI}/Tech-stack)`,
    ]);
  });
});

describe('isGenerated', () => {
  it('is false for a page someone wrote on the wiki', () => {
    assert.equal(isGenerated('Welcome to the app wiki!'), false);
  });
});
