import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, describe, it } from 'node:test';
import { fileStore } from './file-store.ts';

describe('fileStore', () => {
  const root = mkdtempSync(join(tmpdir(), 'observatory-store-'));
  after(() => rmSync(root, { recursive: true, force: true }));
  const store = fileStore(root);

  it('reads back what it wrote, as a file named by the key', async () => {
    await store.set('triage/me__app', { seen: { '1': 'x' } });

    assert.deepEqual(await store.get('triage/me__app'), { seen: { '1': 'x' } });
    const file = readFileSync(join(root, 'triage', 'me__app.json'), 'utf8');
    assert.deepEqual(JSON.parse(file), { seen: { '1': 'x' } });
  });

  it('reads a missing or broken file as none', async () => {
    writeFileSync(join(root, 'broken.json'), '{nope');

    assert.equal(await store.get('nothing/here'), null);
    assert.equal(await store.get('broken'), null);
  });

  it('refuses a key that could leave the folder', async () => {
    for (const key of ['../x', 'a/../../x', '/abs', 'a\\b', '']) {
      await assert.rejects(store.set(key, 1), /not a store key/, key);
    }
  });
});
