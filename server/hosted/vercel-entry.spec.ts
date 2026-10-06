import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { originalRequest, vercelFunction } from './vercel-entry.ts';

describe('originalRequest', () => {
  it('puts back the path vercel.json moved into __path, keeping the query and body', async () => {
    const rewritten = new Request('https://site.example/api/index?__path=push&repo=me/app', {
      method: 'POST',
      headers: { authorization: 'Bearer x' },
      body: '{"a":1}',
    });

    const request = await originalRequest(rewritten);

    assert.equal(request.url, 'https://site.example/api/push?repo=me%2Fapp');
    assert.equal(request.method, 'POST');
    assert.equal(request.headers.get('authorization'), 'Bearer x');
    assert.equal(await request.text(), '{"a":1}');
  });

  it('leaves a request that was not rewritten alone', async () => {
    const request = new Request('https://site.example/api/session');

    assert.equal(await originalRequest(request), request);
  });
});

describe('the Vercel function', () => {
  it('answers through the hosted API, at the original path', async () => {
    const serve = vercelFunction({});

    const response = await serve(new Request('https://site.example/api/index?__path=session'));

    assert.equal(response.status, 500);
    const { error } = (await response.json()) as { error: string };
    assert.match(error, /not configured: missing KV_REST_API_URL/);
  });

  it('loads from api/index.mjs as Vercel runs it, TypeScript and all', async () => {
    const entryUrl = new URL('../../api/index.mjs', import.meta.url).href;
    const entry = (await import(entryUrl)) as Record<string, unknown>;

    assert.equal(typeof entry['GET'], 'function');
    assert.equal(typeof entry['POST'], 'function');
  });
});
