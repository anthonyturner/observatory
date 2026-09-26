import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Store } from '../store/store.ts';
import { editRecordFrom, storeEditStore } from './edit-store.ts';

const record = {
  pr: 7,
  status: 'applied',
  changes: { title: 'T' },
  requestedAt: '2026-09-26T10:00:00.000Z',
  applied: ['title'],
  message: 'applied: title',
  appliedAt: '2026-09-26T10:00:01.000Z',
} as const;

describe('storeEditStore', () => {
  it('keeps one record per pull request, by repository', async () => {
    const saved = new Map<string, unknown>();
    const store: Store = {
      get: async (key) => saved.get(key) ?? null,
      set: async (key, value) => void saved.set(key, value),
    };
    const edits = storeEditStore(store);

    await edits.write({ repo: 'me/app', number: 7 }, record);

    assert.deepEqual([...saved.keys()], ['edits/me__app/7']);
    assert.deepEqual(await edits.read({ repo: 'me/app', number: 7 }), record);
    assert.equal(await edits.read({ repo: 'me/app', number: 8 }), null);
  });
});

describe('editRecordFrom', () => {
  it('reads anything not written as a record as none', () => {
    for (const value of [null, 'x', {}, { ...record, status: 'pending' }, { ...record, pr: '7' }]) {
      assert.equal(editRecordFrom(value), null);
    }
  });
});
