import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BODY_LIMIT_CHARS, clipBody, fitDiff, sizeOf } from './pull-size.ts';

describe('clipBody', () => {
  it('keeps a description that fits, and cuts one that does not', () => {
    assert.deepEqual(clipBody('short'), { body: 'short', bodyTruncated: false });
    assert.deepEqual(clipBody(null), { body: '', bodyTruncated: false });
    const long = clipBody('x'.repeat(BODY_LIMIT_CHARS + 1));
    assert.equal(long.body.length, BODY_LIMIT_CHARS);
    assert.equal(long.bodyTruncated, true);
  });
});

describe('fitDiff', () => {
  const line = (i: number) => `+line ${i} ${'y'.repeat(40)}`;
  const diff = Array.from({ length: 400 }, (_, i) => line(i)).join('\n');
  const detail = { title: 'kept', diff, diffTruncated: false };

  it('leaves a detail that fits alone', () => {
    assert.equal(fitDiff(detail), detail);
  });

  it('cuts the diff at a line end until the whole fits, and says so', () => {
    const limit = 8 * 1024;
    const fitted = fitDiff(detail, limit);

    assert.ok(sizeOf(fitted) <= limit);
    assert.equal(fitted.diffTruncated, true);
    assert.equal(fitted.title, 'kept');
    assert.ok(diff.startsWith(fitted.diff));
    assert.ok(fitted.diff.split('\n').every((each, i) => each === line(i)));
  });

  it('drops the diff entirely when nothing of it fits', () => {
    const fitted = fitDiff({ ...detail, title: 'z'.repeat(2000) }, 1024);
    assert.deepEqual([fitted.diff, fitted.diffTruncated], ['', true]);
  });
});
