import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BadRequest, type RouteTable } from '../http/api-handler.ts';
import { type FetchedPage, ReadError } from './page-fetch.ts';
import { READ_PATH, withReaderRoutes } from './reader-routes.ts';

const BODY = `<article>${Array.from(
  { length: 10 },
  (_, n) =>
    `<p>Paragraph ${n + 1} of the article, long enough for the reader to keep it as prose.</p>`,
).join('')}</article>`;

function reader(fetched: (url: URL) => Promise<FetchedPage>) {
  const asked: string[] = [];
  const empty: RouteTable = { get: {}, post: {}, delete: {} };
  const table = withReaderRoutes(empty, async (url) => {
    asked.push(url.toString());
    return fetched(url);
  });
  const read = (url: string): Promise<unknown> =>
    table.get[READ_PATH](new URLSearchParams({ url }));
  return { asked, read };
}

describe('withReaderRoutes', () => {
  it('reads a page into its readable parts', async () => {
    const { read } = reader(async (url) => ({
      url: url.toString(),
      headers: { 'x-frame-options': 'DENY' },
      html: BODY,
    }));
    const page = (await read('https://example.com/a')) as {
      blocks: unknown[];
      canEmbed: boolean;
      site: string;
    };
    assert.equal(page.blocks.length, 10);
    assert.equal(page.canEmbed, false);
    assert.equal(page.site, 'example.com');
  });

  it('refuses a local address without fetching it', async () => {
    const { read, asked } = reader(async () => {
      throw new Error('must not fetch');
    });
    assert.deepEqual(await read('http://127.0.0.1:80/admin'), {
      url: 'http://127.0.0.1/admin',
      failed: 'addresses on this machine or its network cannot be read',
    });
    assert.deepEqual(asked, []);
  });

  it('says why a page could not be read', async () => {
    const { read } = reader(async () => {
      throw new ReadError('the site answered 403');
    });
    assert.deepEqual(await read('https://example.com/b'), {
      url: 'https://example.com/b',
      failed: 'the site answered 403',
    });
  });

  it('turns away a request with no url or a bad one', async () => {
    const { read } = reader(async () => ({ url: '', headers: {}, html: '' }));
    await assert.rejects(read(''), BadRequest);
    await assert.rejects(read('not a url'), BadRequest);
  });
});
