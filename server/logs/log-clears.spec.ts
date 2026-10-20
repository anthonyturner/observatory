import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { fileStore } from '../store/file-store.ts';
import { clearedAtFrom, storeLogClears } from './log-clears.ts';

const AT = '2026-10-20T09:30:00';

describe('storeLogClears', () => {
  const clearsIn = (root: string) => storeLogClears(fileStore(root));
  const rootOf = () => mkdtempSync(join(tmpdir(), 'observatory-log-clears-'));

  it('keeps each repository’s clear apart, and reads back what it wrote', async () => {
    const clears = clearsIn(rootOf());

    await clears.clear('me/a', AT);

    assert.equal(await clears.clearedAt('me/a'), AT);
    assert.equal(await clears.clearedAt('me/b'), null);
  });

  it('forgets a clear on reset, and a reset of nothing succeeds', async () => {
    const clears = clearsIn(rootOf());
    await clears.clear('me/a', AT);

    await clears.reset('me/a');
    await clears.reset('me/never-cleared');

    assert.equal(await clears.clearedAt('me/a'), null);
  });

  it('keeps the clear of a restarted server, in its own folder', async () => {
    const root = rootOf();
    await clearsIn(root).clear('me/a', AT);

    assert.equal(await clearsIn(root).clearedAt('me/a'), AT);
    assert.deepEqual(JSON.parse(readFileSync(join(root, 'log-clears', 'me__a.json'), 'utf8')), {
      clearedAt: AT,
    });
  });

  it('reads a damaged file as no clear', async () => {
    const root = rootOf();
    mkdirSync(join(root, 'log-clears'));
    writeFileSync(join(root, 'log-clears', 'me__a.json'), '{broken');

    assert.equal(await clearsIn(root).clearedAt('me/a'), null);
  });
});

describe('clearedAtFrom', () => {
  it('takes a log time and nothing else', () => {
    assert.equal(clearedAtFrom({ clearedAt: AT }), AT);
    for (const stored of [
      null,
      'text',
      {},
      { clearedAt: '2026-10-20T09:30:00Z' },
      { clearedAt: 5 },
    ]) {
      assert.equal(clearedAtFrom(stored), null, JSON.stringify(stored));
    }
  });
});
