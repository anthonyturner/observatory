import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { fileStore } from '../store/file-store.ts';
import { EMPTY_TRIAGE } from './triage.ts';
import { storeTriageStore, triageStateFrom } from './triage-store.ts';

describe('storeTriageStore', () => {
  it('keeps each repository’s triage apart and reads back what it wrote', async () => {
    const store = storeTriageStore(fileStore(mkdtempSync(join(tmpdir(), 'observatory-triage-'))));
    const state = { seen: { '7': '2026-09-26T12:00:00Z' }, dismissed: {}, snoozed: {} };

    await store.write('me/a', state);

    assert.deepEqual(await store.read('me/a'), state);
    assert.deepEqual(await store.read('me/b'), EMPTY_TRIAGE);
  });

  it('reads the triage files this machine already has, and a damaged one as none', async () => {
    const root = mkdtempSync(join(tmpdir(), 'observatory-triage-'));
    mkdirSync(join(root, 'triage'));
    writeFileSync(join(root, 'triage', 'me__a.json'), '{"seen":{"3":"2026-09-01T00:00:00Z"}}');
    writeFileSync(join(root, 'triage', 'me__b.json'), '{broken');
    const store = storeTriageStore(fileStore(root));

    assert.deepEqual(await store.read('me/a'), {
      seen: { '3': '2026-09-01T00:00:00Z' },
      dismissed: {},
      snoozed: {},
    });
    assert.deepEqual(await store.read('me/b'), EMPTY_TRIAGE);
  });
});

describe('triageStateFrom', () => {
  it('keeps only string entries, and reads anything else as no triage', () => {
    assert.deepEqual(triageStateFrom({ seen: { '1': 'a', '2': 5 }, snoozed: 'x' }), {
      seen: { '1': 'a' },
      dismissed: {},
      snoozed: {},
    });
    assert.deepEqual(triageStateFrom(null), EMPTY_TRIAGE);
    assert.deepEqual(triageStateFrom([1]), EMPTY_TRIAGE);
  });
});
