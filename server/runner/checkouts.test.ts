import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { cloneCheckouts } from './checkouts.ts';

describe('cloneCheckouts', () => {
  it('lists each project that has a clone, and none that has not', async () => {
    const clones = new Map([['me/app', 'E:/repos/app']]);
    const registry = cloneCheckouts(
      async () => [
        { name: 'app', repo: 'me/app' },
        { name: 'elsewhere', repo: 'me/elsewhere' },
      ],
      { cloneOf: async (repo) => clones.get(repo) ?? null },
    );

    assert.deepEqual(await registry.list(), [
      { name: 'app', repo: 'me/app', folder: 'E:/repos/app' },
    ]);
  });

  it('looks again on every call, so a clone that has gone is no longer listed', async () => {
    const clones = new Map([['me/app', 'E:/repos/app']]);
    const registry = cloneCheckouts(async () => [{ name: 'app', repo: 'me/app' }], {
      cloneOf: async (repo) => clones.get(repo) ?? null,
    });
    await registry.list();

    clones.clear();

    assert.deepEqual(await registry.list(), []);
  });
});
