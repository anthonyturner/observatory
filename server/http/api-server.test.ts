import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { after, before, describe, it } from 'node:test';
import { BadRequest, createApiServer } from './api-server.ts';

describe('createApiServer', () => {
  const server = createApiServer({
    '/api/ok': async () => ({ hello: 'world' }),
    '/api/echo': async (query) => {
      const name = query.get('name');
      if (!name) throw new BadRequest('name is required');
      return { name };
    },
    '/api/broken': async () => {
      throw new Error('boom');
    },
  });
  let base = '';

  before(async () => {
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  after(() => server.close());

  it('answers a known route as JSON', async () => {
    const response = await fetch(`${base}/api/ok`);

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { hello: 'world' });
  });

  it('hands a route its query string', async () => {
    const response = await fetch(`${base}/api/echo?name=me%2Fa`);

    assert.deepEqual(await response.json(), { name: 'me/a' });
  });

  it('answers a bad request with 400 and why', async () => {
    const response = await fetch(`${base}/api/echo`);

    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { error: 'name is required' });
  });

  it('says not found for an unknown path or method', async () => {
    assert.equal((await fetch(`${base}/api/missing`)).status, 404);
    assert.equal((await fetch(`${base}/api/ok`, { method: 'POST' })).status, 404);
  });

  it('turns a failing route into a server error, not a crash', async () => {
    const original = console.error;
    console.error = () => undefined;
    try {
      assert.equal((await fetch(`${base}/api/broken`)).status, 500);
    } finally {
      console.error = original;
    }
  });
});
