import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { after, before, describe, it } from 'node:test';
import { json } from './api-handler.ts';
import { createApiServer } from './api-server.ts';

describe('createApiServer', () => {
  const seen: { method: string; path: string; header: string | null; body: string }[] = [];
  const server = createApiServer(async (request) => {
    const url = new URL(request.url);
    seen.push({
      method: request.method,
      path: `${url.pathname}${url.search}`,
      header: request.headers.get('x-test'),
      body: await request.text(),
    });
    if (url.pathname === '/throws') throw new Error('boom');
    const headers = new Headers({ 'x-reply': 'yes' });
    headers.append('set-cookie', 'a=1; Path=/');
    headers.append('set-cookie', 'b=2; Path=/');
    return json(201, { ok: true }, headers);
  });
  let base = '';

  before(async () => {
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  after(() => server.close());

  it('hands the handler the method, path, headers and body', async () => {
    await fetch(`${base}/api/x?y=1`, { method: 'POST', headers: { 'x-test': 't' }, body: 'hi' });

    assert.deepEqual(seen.at(-1), { method: 'POST', path: '/api/x?y=1', header: 't', body: 'hi' });
  });

  it('sends back the status, headers, every cookie and the body', async () => {
    const response = await fetch(`${base}/api/x`);

    assert.equal(response.status, 201);
    assert.equal(response.headers.get('x-reply'), 'yes');
    assert.deepEqual(response.headers.getSetCookie(), ['a=1; Path=/', 'b=2; Path=/']);
    assert.deepEqual(await response.json(), { ok: true });
  });

  it('answers 500 when the handler throws, and keeps serving', async () => {
    const original = console.error;
    console.error = () => undefined;
    try {
      assert.equal((await fetch(`${base}/throws`)).status, 500);
    } finally {
      console.error = original;
    }
    assert.equal((await fetch(`${base}/api/x`)).status, 201);
  });
});
