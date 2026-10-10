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

  it('finds one project’s checkout whatever the case of its name, and none for a project without a clone', async () => {
    const clones = new Map([['Me/App', 'E:/repos/app']]);
    const registry = cloneCheckouts(
      async () => [
        { name: 'app', repo: 'Me/App' },
        { name: 'elsewhere', repo: 'me/elsewhere' },
      ],
      { cloneOf: async (repo) => clones.get(repo) ?? null },
    );

    assert.deepEqual(await registry.find('me/app'), {
      name: 'app',
      repo: 'Me/App',
      folder: 'E:/repos/app',
    });
    assert.equal(await registry.find('me/elsewhere'), null);
  });

  it('knows no checkout for a repository that is not one of the projects, clone or not', async () => {
    const registry = cloneCheckouts(async () => [{ name: 'app', repo: 'me/app' }], {
      cloneOf: async () => 'E:/anywhere',
    });

    assert.equal(await registry.find('me/stranger'), null);
  });

  it('looks again on every find, so a clone that has gone is no longer found', async () => {
    const clones = new Map([['me/app', 'E:/repos/app']]);
    const registry = cloneCheckouts(async () => [{ name: 'app', repo: 'me/app' }], {
      cloneOf: async (repo) => clones.get(repo) ?? null,
    });
    assert.ok(await registry.find('me/app'));

    clones.clear();

    assert.equal(await registry.find('me/app'), null);
  });
});
