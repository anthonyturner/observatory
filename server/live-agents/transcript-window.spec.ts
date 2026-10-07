import assert from 'node:assert/strict';
import { appendFileSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, describe, it } from 'node:test';
import { lastLines, lineSpansFrom, linesFrom, tailLines } from './transcript-window.ts';

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

describe('lineSpansFrom', () => {
  it('gives each whole line with the offset past it, leaving a half-written one', async () => {
    const file = join(root, 'spans.jsonl');
    writeFileSync(file, 'ab\n\ncde\nf');

    assert.deepEqual(await lineSpansFrom(file, 0, 100), {
      lines: [
        { text: 'ab', end: 3 },
        { text: 'cde', end: 8 },
      ],
      next: 8,
    });
    assert.deepEqual(await lineSpansFrom(file, 3, 100), {
      lines: [{ text: 'cde', end: 8 }],
      next: 8,
    });
  });

  it('reads no more than it is allowed, ending at the last whole line inside', async () => {
    const file = join(root, 'bounded.jsonl');
    writeFileSync(file, 'one\ntwo\nthree\n');

    assert.deepEqual(await lineSpansFrom(file, 0, 9), {
      lines: [
        { text: 'one', end: 4 },
        { text: 'two', end: 8 },
      ],
      next: 8,
    });
  });

  it('steps over a line longer than a read, once it is whole, and waits while it is not', async () => {
    const file = join(root, 'long.jsonl');
    const long = 'x'.repeat(70 * 1024);
    writeFileSync(file, long);

    assert.deepEqual(await lineSpansFrom(file, 0, 1024), { lines: [], next: 0 });

    appendFileSync(file, '\nafter\n');

    assert.deepEqual(await lineSpansFrom(file, 0, 1024), { lines: [], next: long.length + 1 });
  });

  it('answers null for a missing file, or one now shorter than the cursor', async () => {
    const file = join(root, 'short.jsonl');
    writeFileSync(file, 'a\n');

    assert.equal(await lineSpansFrom(file, 50, 100), null);
    assert.equal(await lineSpansFrom(join(root, 'none.jsonl'), 0, 100), null);
  });
});
