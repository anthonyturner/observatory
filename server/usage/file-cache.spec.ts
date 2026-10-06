import assert from 'node:assert/strict';
import { mkdtempSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import {
  type EntryStore,
  type FileEntries,
  changedSince,
  fileKey,
  jsonEntryStore,
  valuesPerFile,
} from './file-cache.ts';

const memoryStore = <T>(): EntryStore<T> & { saved: () => FileEntries<T> } => {
  let stored: FileEntries<T> = {};
  return {
    saved: () => stored,
    read: async () => stored,
    write: async (entries) => {
      stored = entries;
    },
  };
};

describe('valuesPerFile', () => {
  it('reads a file only when its key has changed', async () => {
    const store = memoryStore<string>();
    const reads: string[] = [];
    const read = async (file: string) => {
      reads.push(file);
      return `value of ${file}`;
    };
    let keyOfB = 'b1';
    const keyOf = async (file: string) => (file === 'b' ? keyOfB : 'a1');

    await valuesPerFile(['a', 'b'], store, keyOf, read);
    keyOfB = 'b2';
    const values = await valuesPerFile(['a', 'b'], store, keyOf, read);

    assert.deepEqual(reads, ['a', 'b', 'b']);
    assert.equal(values.get('a'), 'value of a');
  });

  it('drops the files no longer listed, and skips one that cannot be read', async () => {
    const store = memoryStore<string>();
    const keyOf = async (file: string) => (file === 'gone' ? null : 'k');

    await valuesPerFile(['a', 'b'], store, keyOf, async () => 'v');
    await valuesPerFile(['a', 'gone'], store, keyOf, async () => 'v');

    assert.deepEqual(Object.keys(store.saved()), ['a']);
  });
});

describe('files on disk', () => {
  const dir = mkdtempSync(join(tmpdir(), 'file-cache-'));

  it('keys a file by its size and modification time, and a missing one as null', async () => {
    const file = join(dir, 'one.txt');
    writeFileSync(file, 'abc');
    const before = await fileKey(file);
    writeFileSync(file, 'abcd');

    assert.notEqual(await fileKey(file), before);
    assert.equal(await fileKey(join(dir, 'none.txt')), null);
  });

  it('keeps only files changed at or after a moment', async () => {
    const old = join(dir, 'old.txt');
    const fresh = join(dir, 'fresh.txt');
    writeFileSync(old, '');
    writeFileSync(fresh, '');
    utimesSync(old, new Date('2026-01-01'), new Date('2026-01-01'));

    assert.deepEqual(
      await changedSince([old, fresh, join(dir, 'gone.txt')], Date.parse('2026-06-01')),
      [fresh],
    );
  });

  it('keeps entries in a JSON file, and starts afresh on another version or a broken file', async () => {
    const path = join(dir, 'nested', 'cache.json');
    await jsonEntryStore<number>(path, 1).write({ a: { key: 'k', value: 7 } });

    assert.deepEqual(await jsonEntryStore<number>(path, 1).read(), { a: { key: 'k', value: 7 } });
    assert.deepEqual(await jsonEntryStore<number>(path, 2).read(), {});
    writeFileSync(path, '{broken');
    assert.deepEqual(await jsonEntryStore<number>(path, 1).read(), {});
  });
});
