import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BadRequest, createApiHandler } from './api-handler.ts';

describe('createApiHandler', () => {
  const handle = createApiHandler({
    get: {
      '/api/ok': async () => ({ hello: 'world' }),
      '/api/echo': async (query) => {
        const name = query.get('name');
        if (!name) throw new BadRequest('name is required');
        return { name };
      },
      '/api/broken': async () => {
        throw new Error('boom');
      },
    },
    post: {
      '/api/write': async (body) => ({ got: body }),
    },
  });
  const base = 'http://localhost';
  const get = (path: string) => handle(new Request(`${base}${path}`));
  const write = (init: RequestInit) =>
    handle(new Request(`${base}/api/write`, { method: 'POST', ...init }));

  it('answers a known route as JSON, never cached', async () => {
    const response = await get('/api/ok');

    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.deepEqual(await response.json(), { hello: 'world' });
  });

  it('hands a route its query string', async () => {
    assert.deepEqual(await (await get('/api/echo?name=me%2Fa')).json(), { name: 'me/a' });
  });

  it('answers a bad request with 400 and why', async () => {
    const response = await get('/api/echo');

    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { error: 'name is required' });
  });

  it('says not found for an unknown path or method', async () => {
    assert.equal((await get('/api/missing')).status, 404);
    assert.equal((await handle(new Request(`${base}/api/ok`, { method: 'POST' }))).status, 404);
  });

  it('takes a write that carries the header and JSON', async () => {
    const response = await write({
      headers: { 'x-observatory': '1', 'content-type': 'application/json' },
      body: JSON.stringify({ a: 1 }),
    });

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { got: { a: 1 } });
  });

  it('refuses a write without the header, as another site would send it', async () => {
    assert.equal(
      (await write({ headers: { 'content-type': 'text/plain' }, body: '{}' })).status,
      403,
    );
  });

  it('refuses a write that is not JSON, or too large', async () => {
    const headers = { 'x-observatory': '1' };
    const json = { ...headers, 'content-type': 'application/json' };
    assert.equal(
      (await write({ headers: { ...headers, 'content-type': 'text/plain' }, body: 'x' })).status,
      415,
    );
    assert.equal((await write({ headers: json, body: '{nope' })).status, 400);
    const huge = JSON.stringify({ text: 'x'.repeat(20_000) });
    assert.equal((await write({ headers: json, body: huge })).status, 400);
  });

  it('turns a failing route into a server error, not a crash', async () => {
    const original = console.error;
    console.error = () => undefined;
    try {
      assert.equal((await get('/api/broken')).status, 500);
    } finally {
      console.error = original;
    }
  });
});
