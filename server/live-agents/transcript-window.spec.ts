import assert from 'node:assert/strict';
import { appendFileSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, describe, it } from 'node:test';
import { lastLines, linesFrom, tailLines } from './transcript-window.ts';

const root = mkdtempSync(join(tmpdir(), 'transcript-window-'));
after(() => rmSync(root, { recursive: true, force: true }));

const TEXT = 'first line\nsecond\nthird\n';

describe('lastLines', () => {
  it('keeps the whole lines inside the window, one starting at its edge included', async () => {
    const file = join(root, 'tail.jsonl');
    writeFileSync(file, TEXT);

    assert.deepEqual(await tailLines(file, 13), ['second', 'third']);
    assert.deepEqual(await tailLines(file, 12), ['third']);
    assert.deepEqual(await tailLines(file), ['first line', 'second', 'third']);
    assert.equal((await lastLines(file))?.next, TEXT.length);
  });

  it('leaves a last line still being written for the next read, and reads a missing file as nothing', async () => {
    const file = join(root, 'growing.jsonl');
    writeFileSync(file, '{"a":1}\n{"b":');

    assert.deepEqual(await lastLines(file), { lines: ['{"a":1}'], next: 8 });
    assert.equal(await lastLines(join(root, 'gone.jsonl')), null);
  });
});

describe('linesFrom', () => {
  it('reads only what was written after a cursor', async () => {
    const file = join(root, 'cursor.jsonl');
    writeFileSync(file, TEXT);
    const first = await lastLines(file);
    appendFileSync(file, 'fourth\nfif');

    const next = await linesFrom(file, first?.next ?? 0);

    assert.deepEqual(next, { lines: ['fourth'], next: TEXT.length + 7 });
  });

  it('answers null for a file now shorter than the cursor, as one written afresh is', async () => {
    const file = join(root, 'rewritten.jsonl');
    writeFileSync(file, 'short\n');

    assert.equal(await linesFrom(file, 100), null);
  });
});
