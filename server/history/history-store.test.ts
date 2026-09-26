import assert from 'node:assert/strict';
import { appendFileSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import type { Store } from '../store/store.ts';
import { type Frame, MAX_FRAMES } from './frames.ts';
import { fileHistoryStore, framesFrom, storeHistoryStore } from './history-store.ts';

const frameAt = (index: number): Frame => ({
  at: new Date(Date.UTC(2026, 0, 1) + index * 60_000).toISOString(),
  items: [],
  departed: [],
});

/** A Store over a Map, as the hosted site's Redis would behave. */
function memoryStore(): Store & { readonly data: Map<string, unknown> } {
  const data = new Map<string, unknown>();
  return {
    data,
    get: async (key) => data.get(key) ?? null,
    set: async (key, value) => void data.set(key, structuredClone(value)),
  };
}

describe('fileHistoryStore', () => {
  it('reads back what it appended, oldest first, per repository', async () => {
    const store = fileHistoryStore(mkdtempSync(join(tmpdir(), 'observatory-history-')));

    await store.append('me/a', frameAt(2));
    await store.append('me/a', frameAt(1));

    assert.deepEqual(await store.read('me/a'), [frameAt(1), frameAt(2)]);
    assert.deepEqual(await store.read('me/b'), []);
  });

  it('skips a torn line and keeps the rest', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'observatory-history-'));
    const store = fileHistoryStore(dir);
    await store.append('me/a', frameAt(1));
    appendFileSync(join(dir, 'me__a.jsonl'), '{"at":"2026-');

    assert.deepEqual(await store.read('me/a'), [frameAt(1)]);
  });

  it('reads the newest frames only, and trims the file once it holds twice as many', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'observatory-history-'));
    const store = fileHistoryStore(dir);
    for (let index = 0; index < MAX_FRAMES * 2; index++) await store.append('me/a', frameAt(index));

    const frames = await store.read('me/a');
    const lines = readFileSync(join(dir, 'me__a.jsonl'), 'utf8').trim().split('\n');

    assert.equal(frames.length, MAX_FRAMES);
    assert.deepEqual(frames.at(-1), frameAt(MAX_FRAMES * 2 - 1));
    assert.equal(lines.length, MAX_FRAMES);
  });
});

describe('storeHistoryStore', () => {
  it('keeps each repository’s frames as one document, oldest first', async () => {
    const backing = memoryStore();
    const store = storeHistoryStore(backing);

    await store.append('me/a', frameAt(2));
    await store.append('me/a', frameAt(1));

    assert.deepEqual(await store.read('me/a'), [frameAt(1), frameAt(2)]);
    assert.deepEqual(await store.read('me/b'), []);
    assert.deepEqual(backing.data.get('history/me__a'), { frames: [frameAt(1), frameAt(2)] });
  });

  it('keeps only the newest MAX_FRAMES', async () => {
    const backing = memoryStore();
    const store = storeHistoryStore(backing);
    for (let index = 0; index <= MAX_FRAMES; index++) await store.append('me/a', frameAt(index));

    const frames = await store.read('me/a');

    assert.equal(frames.length, MAX_FRAMES);
    assert.deepEqual(frames[0], frameAt(1));
  });
});

describe('framesFrom', () => {
  it('reads frames and leaves out anything that is not one', () => {
    assert.deepEqual(framesFrom({ frames: [frameAt(2), { at: 3 }, frameAt(1)] }), [
      frameAt(1),
      frameAt(2),
    ]);
    assert.deepEqual(framesFrom(null), []);
    assert.deepEqual(framesFrom({ frames: 'no' }), []);
  });
});
