import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { rawWikiReader, wikiRawUrl } from './wiki-reader.ts';

/** A fetch answering every request with `status` and `body`, recording each URL. */
function fakeFetch(status: number, body = ''): { send: typeof fetch; urls: string[] } {
  const urls: string[] = [];
  const send = (async (url: string | URL | Request) => {
    urls.push(String(url));
    return new Response(body, { status });
  }) as typeof fetch;
  return { send, urls };
}

describe('wikiRawUrl', () => {
  it('encodes each part of the path', () => {
    assert.equal(
      wikiRawUrl('me/app', 'images/a b.png'),
      'https://raw.githubusercontent.com/wiki/me/app/images/a%20b.png',
    );
  });
});

describe('rawWikiReader', () => {
  it('reads a page’s markdown raw', async () => {
    const { send, urls } = fakeFetch(200, '# Home');

    assert.equal(await rawWikiReader(send).wikiPage('me/app', 'Home'), '# Home');
    assert.deepEqual(urls, ['https://raw.githubusercontent.com/wiki/me/app/Home.md']);
  });

  it('reads a missing or private page as none', async () => {
    assert.equal(await rawWikiReader(fakeFetch(404).send).wikiPage('me/app', 'Home'), null);
  });

  it('passes any other failure on', async () => {
    await assert.rejects(rawWikiReader(fakeFetch(503).send).wikiPage('me/app', 'Home'), /503/);
  });
});
