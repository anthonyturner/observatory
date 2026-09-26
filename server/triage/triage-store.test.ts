import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { EMPTY_TRIAGE } from './triage.ts';
import { fileTriageStore } from './triage-store.ts';

describe('fileTriageStore', () => {
  it('keeps each repository’s triage apart and reads back what it wrote', () => {
    const store = fileTriageStore(mkdtempSync(join(tmpdir(), 'observatory-triage-')));
    const state = { seen: { '7': '2026-09-26T12:00:00Z' }, dismissed: {}, snoozed: {} };

    store.write('me/a', state);

    assert.deepEqual(store.read('me/a'), state);
    assert.deepEqual(store.read('me/b'), EMPTY_TRIAGE);
  });

  it('reads a damaged file as no triage', () => {
    const dir = mkdtempSync(join(tmpdir(), 'observatory-triage-'));
    writeFileSync(join(dir, 'me__a.json'), '{broken');

    assert.deepEqual(fileTriageStore(dir).read('me/a'), EMPTY_TRIAGE);
  });
});
