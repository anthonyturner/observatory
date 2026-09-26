import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BadRequest, Forbidden, NotFound, createApiHandler } from './api-handler.ts';

describe('createApiHandler', () => {
  const handle = createApiHandler({
    get: {
      '/api/ok': async () => ({ hello: 'world' }),
      '/api/echo': async (query) => {
        const name = query.get('name');
        if (!name) throw new BadRequest('name is required');
        return { name };
      },
      '/api/gone': async () => {
        throw new NotFound('no such thing');
      },
      '/api/private': async () => {
        throw new Forbidden('not for you');
      },
      '/api/broken': async () => {
        throw new Error('boom');
      },
    },
    post: {
      '/api/write': async (body) => ({ got: body }),
      '/api/large': async () => ({ ok: true }),
    },
    bodyLimits: { '/api/large': 64 * 1024 },
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

  it('answers a route that says not found or forbidden with 404 or 403 and why', async () => {
    const gone = await get('/api/gone');
    const hidden = await get('/api/private');

    assert.equal(gone.status, 404);
    assert.deepEqual(await gone.json(), { error: 'no such thing' });
    assert.equal(hidden.status, 403);
    assert.deepEqual(await hidden.json(), { error: 'not for you' });
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

  it('takes a larger body on a route allowed one', async () => {
    const response = await handle(
      new Request(`${base}/api/large`, {
        method: 'POST',
        headers: { 'x-observatory': '1', 'content-type': 'application/json' },
        body: JSON.stringify({ text: 'x'.repeat(20_000) }),
      }),
    );
    assert.equal(response.status, 200);
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
