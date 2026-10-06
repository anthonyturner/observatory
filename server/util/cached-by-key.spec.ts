import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { cachedByKey, keyedCache } from './cached-by-key.ts';

describe('cachedByKey', () => {
  it('keeps each key’s answer apart, and reuses it until it is too old', async () => {
    let now = 0;
    const loads: string[] = [];
    const read = cachedByKey(
      async (key) => {
        loads.push(key);
        return key.toUpperCase();
      },
      1000,
      () => now,
    );

    assert.equal(await read('a'), 'A');
    assert.equal(await read('b'), 'B');
    assert.equal(await read('a'), 'A');
    now = 1000;
    await read('a');

    assert.deepEqual(loads, ['a', 'b', 'a']);
  });
});

describe('keyedCache', () => {
  it('loads a forgotten key again, and only that key', async () => {
    const loads: string[] = [];
    const cache = keyedCache(async (key) => {
      loads.push(key);
      return key;
    }, 60_000);

    await cache.read('a');
    await cache.read('b');
    cache.forget('a');
    await cache.read('a');
    await cache.read('b');

    assert.deepEqual(loads, ['a', 'b', 'a']);
  });
});
