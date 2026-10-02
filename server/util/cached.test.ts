import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { cached } from './cached.ts';

describe('cached', () => {
  it('reuses an answer until it is too old', async () => {
    let now = 0;
    let loads = 0;
    const read = cached(
      async () => ++loads,
      1000,
      () => now,
    );

    assert.equal(await read(), 1);
    now = 999;
    assert.equal(await read(), 1);
    now = 1000;
    assert.equal(await read(), 2);
  });

  it('shares one load between callers that arrive together', async () => {
    let loads = 0;
    const read = cached(async () => {
      loads++;
      await new Promise((resolve) => setTimeout(resolve, 5));
      return loads;
    }, 1000);

    assert.deepEqual(await Promise.all([read(), read(), read()]), [1, 1, 1]);
  });

  it('does not keep a failure', async () => {
    let fail = true;
    const read = cached(async () => {
      if (fail) throw new Error('down');
      return 'up';
    }, 1000);

    await assert.rejects(read());
    fail = false;
    assert.equal(await read(), 'up');
  });

  it('keeps each answer for as long as its lifetime says', async () => {
    let now = 0;
    let loads = 0;
    const read = cached(
      async () => ++loads,
      (answer) => (answer === 1 ? 5000 : 1000),
      () => now,
    );

    assert.equal(await read(), 1);
    now = 4999;
    assert.equal(await read(), 1);
    now = 5000;
    assert.equal(await read(), 2);
    now = 6000;
    assert.equal(await read(), 3);
  });
});
