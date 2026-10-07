import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { WikiReader } from '../github/wiki-reader.ts';
import {
  WIKI_PAGE_LIMIT,
  namedPage,
  pagesLinkedFrom,
  readWiki,
  wikiPages,
  withMarkdownLinks,
} from './wiki-shelf.ts';

const REPO = 'me/app';

/** A wiki of these pages, recording each page asked for. */
function wikiOf(pages: Record<string, string>): WikiReader & { asked: string[] } {
  const asked: string[] = [];
  return {
    asked,
    wikiPage: async (_repo, page) => {
      asked.push(page);
      return pages[page] ?? null;
    },
  };
}

describe('withMarkdownLinks', () => {
  it('turns the wiki’s own links into markdown links, leaving code alone', () => {
    assert.equal(
      withMarkdownLinks('[[Getting started]] and [[the FAQ|FAQ]] but `[[Not one]]`'),
      '[Getting started](Getting-started) and [the FAQ](FAQ) but `[[Not one]]`',
    );
  });
});

describe('namedPage', () => {
  it('reads a page from its name or its full wiki address', () => {
    assert.equal(namedPage('Getting-started#install', REPO), 'Getting-started');
    assert.equal(namedPage('Getting%20started', REPO), 'Getting-started');
    assert.equal(namedPage('https://github.com/Me/App/wiki/FAQ', REPO), 'FAQ');
    assert.equal(namedPage('https://github.com/me/app/wiki', REPO), 'Home');
  });

  it('reads no page from another site, an anchor, a file or a special page', () => {
    for (const target of [
      'https://github.com/other/app/wiki/FAQ',
      '#heading',
      'images/sky.png',
      '_Footer',
      'folder/Page',
    ]) {
      assert.equal(namedPage(target, REPO), null, target);
    }
  });
});

describe('pagesLinkedFrom', () => {
  it('lists each page linked once, in reading order', () => {
    assert.deepEqual(pagesLinkedFrom('[a](FAQ) [[Setup]] [b](FAQ) [c](https://x.dev)', REPO), [
      'FAQ',
      'Setup',
    ]);
  });
});

describe('readWiki', () => {
  it('reads nothing when the wiki has no Home page', async () => {
    assert.equal(await readWiki(wikiOf({}), REPO), null);
  });

  it('follows links from the sidebar and Home, sidebar order first, skipping missing pages', async () => {
    const wiki = wikiOf({
      Home: '[[Setup]] [[Gone]]',
      _Sidebar: '[[FAQ]]',
      FAQ: '[[Deep]] [back](Home)',
      Setup: '',
      Deep: '[[FAQ]]',
    });

    const read = await readWiki(wiki, REPO);

    assert.deepEqual([...(read?.pages.keys() ?? [])], ['Home', 'FAQ', 'Setup', 'Deep']);
    assert.equal(read?.isTruncated, false);
    assert.equal(wiki.asked.filter((page) => page === 'FAQ').length, 1);
  });

  it('stops at the page limit and says so', async () => {
    const links = Array.from({ length: WIKI_PAGE_LIMIT + 5 }, (_, n) => `[[P${n}]]`).join(' ');
    const pages: Record<string, string> = { Home: links };
    for (let n = 0; n < WIKI_PAGE_LIMIT + 5; n++) pages[`P${n}`] = '';

    const read = await readWiki(wikiOf(pages), REPO);

    assert.equal(read?.pages.size, WIKI_PAGE_LIMIT);
    assert.equal(read?.isTruncated, true);
  });
});

describe('wikiPages', () => {
  it('titles pages as GitHub does and points their links into the Library', () => {
    const pages = new Map([
      ['Home', '[[Getting started]] [faq](FAQ#q) ![logo](images/logo.png)\r\n[x](https://x.dev)'],
      ['Getting-started', 'Hi'],
    ]);

    const [home, started] = wikiPages(REPO, pages);

    assert.equal(started.title, 'Getting started');
    assert.equal(started.url, 'https://github.com/me/app/wiki/Getting-started');
    assert.equal(home.shelf, 'Wiki');
    assert.equal(
      home.markdown,
      '[Getting started](/p/me/app/library/Getting-started)' +
        ' [faq](https://github.com/me/app/wiki/FAQ#q)' +
        ' ![logo](https://raw.githubusercontent.com/wiki/me/app/images/logo.png)\n' +
        '[x](https://x.dev)',
    );
  });
});
