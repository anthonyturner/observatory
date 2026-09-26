import assert from 'node:assert/strict';
import { appendFileSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { type Frame, MAX_FRAMES } from './frames.ts';
import { fileHistoryStore } from './history-store.ts';

const frameAt = (index: number): Frame => ({
  at: new Date(Date.UTC(2026, 0, 1) + index * 60_000).toISOString(),
  items: [],
  departed: [],
});

describe('fileHistoryStore', () => {
  it('reads back what it appended, oldest first, per repository', () => {
    const store = fileHistoryStore(mkdtempSync(join(tmpdir(), 'observatory-history-')));

    store.append('me/a', frameAt(2));
    store.append('me/a', frameAt(1));

    assert.deepEqual(store.read('me/a'), [frameAt(1), frameAt(2)]);
    assert.deepEqual(store.read('me/b'), []);
  });

  it('skips a torn line and keeps the rest', () => {
    const dir = mkdtempSync(join(tmpdir(), 'observatory-history-'));
    const store = fileHistoryStore(dir);
    store.append('me/a', frameAt(1));
    appendFileSync(join(dir, 'me__a.jsonl'), '{"at":"2026-');

    assert.deepEqual(store.read('me/a'), [frameAt(1)]);
  });

  it('reads the newest frames only, and trims the file once it holds twice as many', () => {
    const dir = mkdtempSync(join(tmpdir(), 'observatory-history-'));
    const store = fileHistoryStore(dir);
    for (let index = 0; index < MAX_FRAMES * 2; index++) store.append('me/a', frameAt(index));

    const frames = store.read('me/a');
    const lines = readFileSync(join(dir, 'me__a.jsonl'), 'utf8').trim().split('\n');

    assert.equal(frames.length, MAX_FRAMES);
    assert.deepEqual(frames.at(-1), frameAt(MAX_FRAMES * 2 - 1));
    assert.equal(lines.length, MAX_FRAMES);
  });
});
