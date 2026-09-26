import assert from 'node:assert/strict';
import { PassThrough } from 'node:stream';
import { finished } from 'node:stream/promises';
import { describe, it } from 'node:test';
import { readLines } from './line-reader.ts';

/** What `readLines` hands on for `chunks` written in turn. */
async function linesOf(chunks: readonly string[], maxChars = 100): Promise<string[]> {
  const stream = new PassThrough();
  const seen: string[] = [];
  readLines(stream, maxChars, {
    onLine: (line) => seen.push(line),
    onOverlong: (head, size) => seen.push(`overlong ${head.length}/${size}`),
  });
  for (const chunk of chunks) stream.write(chunk);
  stream.end();
  await finished(stream);
  return seen;
}

describe('readLines', () => {
  it('joins lines split across chunks and drops a trailing carriage return', async () => {
    assert.deepEqual(await linesOf(['one\r\ntw', 'o\n', 'three']), ['one', 'two', 'three']);
  });

  it('keeps only the head of a line over the limit, and its size', async () => {
    const long = 'x'.repeat(1_000);

    assert.deepEqual(await linesOf([long.slice(0, 600), `${long.slice(600)}\nafter\n`], 500), [
      'overlong 400/1000',
      'after',
    ]);
  });

  it('reports an overlong last line when the stream ends', async () => {
    assert.deepEqual(await linesOf(['y'.repeat(50)], 10), ['overlong 50/50']);
  });
});
