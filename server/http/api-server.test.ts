import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { after, before, describe, it } from 'node:test';
import { json } from './api-handler.ts';
import { createApiServer } from './api-server.ts';

const FIRST_LINE = 'first\n';
const streamCancelled = Promise.withResolvers<void>();

/** A body that sends one line and then holds the response open until the caller leaves. */
const streaming = (): Response =>
  new Response(
    new ReadableStream<Uint8Array>({
      start: (controller) => controller.enqueue(new TextEncoder().encode(FIRST_LINE)),
      cancel: () => streamCancelled.resolve(),
    }),
  );

/** Holds a response back until the test lets it go, as a slow route does. */
const lateRelease = Promise.withResolvers<void>();
const lateCancelled = Promise.withResolvers<void>();
const lateStreaming = (): Response =>
  new Response(new ReadableStream<Uint8Array>({ cancel: () => lateCancelled.resolve() }));
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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
    if (url.pathname === '/stream') return streaming();
    if (url.pathname === '/late-stream') {
      await lateRelease.promise;
      return lateStreaming();
    }
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

  it('sends a streamed body as it comes, and stops the stream when the caller leaves', async () => {
    const leave = new AbortController();
    const response = await fetch(`${base}/stream`, { signal: leave.signal });
    const reader = response.body?.getReader();

    const first = await reader?.read();
    leave.abort();

    assert.equal(new TextDecoder().decode(first?.value), FIRST_LINE);
    await streamCancelled.promise;
  });

  it('stops a stream whose caller left before the response was ready', async () => {
    const leave = new AbortController();
    const asked = fetch(`${base}/late-stream`, { signal: leave.signal }).catch(() => undefined);
    await pause(50);
    leave.abort();
    await asked;
    await pause(50);

    lateRelease.resolve();

    await lateCancelled.promise;
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
