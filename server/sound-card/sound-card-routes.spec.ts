import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createApiHandler } from '../http/api-handler.ts';
import { handSource } from './fake-source.ts';
import { SoundCardCapture } from './sound-card-capture.ts';
import { withSoundCardRoutes } from './sound-card-routes.ts';

const FORMAT = { sampleRate: 48_000, channels: 2 };
const quiet = () => undefined;

function server(isAvailable = true) {
  const hand = handSource();
  const capture = new SoundCardCapture(hand.source);
  const handle = createApiHandler(
    withSoundCardRoutes(
      { get: {}, post: {} },
      { capture, format: FORMAT, isAvailable, warn: quiet },
    ),
  );
  return { ...hand, capture, handle };
}

const status = () => new Request('http://x/api/sound-card');
const stream = (headers: Record<string, string> = { 'x-observatory': '1' }) =>
  new Request('http://x/api/sound-card/stream', { headers });

/** Lets a route that awaits the capture reach the point where it waits. */
const settle = () => new Promise((resolve) => setImmediate(resolve));

describe('withSoundCardRoutes', () => {
  it('says the sound card is available where it can be captured', async () => {
    const response = await server().handle(status());

    assert.deepEqual(await response.json(), { available: true });
  });

  it('says it is not available elsewhere, and streams nothing there', async () => {
    const { handle, counts } = server(false);

    assert.deepEqual(await (await handle(status())).json(), { available: false });
    assert.equal((await handle(stream())).status, 503);
    assert.equal(counts.starts, 0);
  });

  it('starts no capture for a request without the write header', async () => {
    const { handle, counts } = server();

    assert.equal((await handle(stream({}))).status, 403);
    assert.equal(counts.starts, 0);
  });

  it('streams the sound as it comes, saying its format', async () => {
    const { handle, live } = server();
    const answered = handle(stream());
    await settle();
    live().started();
    const response = await answered;
    const reader = response.body?.getReader();
    live().data(new Uint8Array([1, 2, 3, 4]));

    assert.equal(response.headers.get('content-type'), 'application/octet-stream');
    assert.equal(response.headers.get('x-sample-rate'), '48000');
    assert.equal(response.headers.get('x-channels'), '2');
    assert.deepEqual([...((await reader?.read())?.value ?? [])], [1, 2, 3, 4]);
  });

  it('stops capturing when the last page listening goes away', async () => {
    const { handle, live, counts, capture } = server();
    const first = handle(stream());
    const second = handle(stream());
    await settle();
    live().started();
    const responses = await Promise.all([first, second]);

    await responses[0]?.body?.cancel();
    assert.equal(counts.stops, 0);
    await responses[1]?.body?.cancel();

    assert.equal(counts.stops, 1);
    assert.equal(capture.listenerCount, 0);
  });

  it('ends the stream when the capture ends', async () => {
    const { handle, live } = server();
    const answered = handle(stream());
    await settle();
    live().started();
    const reader = (await answered).body?.getReader();

    live().ended('the device went away');

    assert.equal((await reader?.read())?.done, true);
  });

  it('answers 503 when the capture cannot start', async () => {
    const { handle, live, capture } = server();
    const answered = handle(stream());
    await settle();

    live().ended('loopback unavailable');
    const response = await answered;

    assert.equal(response.status, 503);
    assert.equal(capture.listenerCount, 0);
  });
});
