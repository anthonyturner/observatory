import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { handSource } from './fake-source.ts';
import type { PcmListener } from './pcm-source.ts';
import { SoundCardCapture } from './sound-card-capture.ts';

function recorder() {
  const chunks: number[][] = [];
  const endings: (string | null)[] = [];
  const listener: PcmListener = {
    data: (chunk) => chunks.push([...chunk]),
    ended: (problem) => endings.push(problem),
  };
  return { listener, chunks, endings };
}

describe('SoundCardCapture', () => {
  it('starts nothing until someone listens', () => {
    const { source, counts } = handSource();

    new SoundCardCapture(source);

    assert.equal(counts.starts, 0);
  });

  it('starts one capture for the first listener and shares it with the next', async () => {
    const { source, counts, live } = handSource();
    const capture = new SoundCardCapture(source);
    const first = recorder();
    const second = recorder();

    const listening = capture.listen(first.listener);
    capture.listen(second.listener);
    live().started();
    await listening.ready;
    live().data(new Uint8Array([1, 2]));

    assert.equal(counts.starts, 1);
    assert.deepEqual(first.chunks, [[1, 2]]);
    assert.deepEqual(second.chunks, [[1, 2]]);
  });

  it('keeps capturing while anyone still listens, and stops when the last one leaves', () => {
    const { source, counts } = handSource();
    const capture = new SoundCardCapture(source);
    const first = capture.listen(recorder().listener);
    const second = capture.listen(recorder().listener);

    first.stop();
    assert.equal(counts.stops, 0);
    assert.equal(capture.listenerCount, 1);

    second.stop();
    assert.equal(counts.stops, 1);
    assert.equal(capture.listenerCount, 0);
  });

  it('stops only once when a listener lets go twice', () => {
    const { source, counts } = handSource();
    const listening = new SoundCardCapture(source).listen(recorder().listener);

    listening.stop();
    listening.stop();

    assert.equal(counts.stops, 1);
  });

  it('starts a fresh capture for a listener who comes after the last one left', () => {
    const { source, counts } = handSource();
    const capture = new SoundCardCapture(source);

    capture.listen(recorder().listener).stop();
    capture.listen(recorder().listener);

    assert.equal(counts.starts, 2);
  });

  it('tells every listener when the capture ends, and starts again for the next', () => {
    const { source, counts, live } = handSource();
    const capture = new SoundCardCapture(source);
    const first = recorder();
    const second = recorder();
    capture.listen(first.listener);
    capture.listen(second.listener);

    live().ended('the device went away');
    capture.listen(recorder().listener);

    assert.deepEqual(first.endings, ['the device went away']);
    assert.deepEqual(second.endings, ['the device went away']);
    assert.equal(counts.starts, 2);
  });

  it('refuses a listener whose capture fails before it starts, saying why', async () => {
    const { source, live } = handSource();
    const listening = new SoundCardCapture(source).listen(recorder().listener);

    live().ended('loopback unavailable');

    await assert.rejects(listening.ready, /loopback unavailable/);
  });
});
