import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { after, before, describe, it } from 'node:test';
import { createApiServer } from './api-server.ts';

describe('createApiServer', () => {
  const server = createApiServer({
    '/api/ok': async () => ({ hello: 'world' }),
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
