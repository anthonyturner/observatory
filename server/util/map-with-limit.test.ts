import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { mapWithLimit } from './map-with-limit.ts';

describe('mapWithLimit', () => {
  it('keeps order and never runs more than the limit at once', async () => {
    let running = 0;
    let most = 0;
    const results = await mapWithLimit([5, 1, 4, 2, 3], 2, async (value) => {
      running++;
      most = Math.max(most, running);
      await new Promise((resolve) => setTimeout(resolve, value));
      running--;
      return value * 10;
    });

    assert.deepEqual(results, [50, 10, 40, 20, 30]);
    assert.equal(most, 2);
  });

  it('handles an empty list', async () => {
    assert.deepEqual(await mapWithLimit([], 3, async (value) => value), []);
  });
});
