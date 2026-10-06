import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BadRequest } from '../http/api-handler.ts';
import { commitDiffOf, commitShaFrom } from './commit-diff.ts';
import { DETAIL_LIMIT_BYTES } from './pull-size.ts';

const FETCHED = '2026-10-05T00:00:00Z';

describe('commitShaFrom', () => {
  it('takes a short or full hash, lower-cased', () => {
    assert.equal(commitShaFrom('5645CDA'), '5645cda');
    assert.equal(commitShaFrom('f'.repeat(40)), 'f'.repeat(40));
  });

  it('refuses anything that is not 7 to 40 hex characters', () => {
    for (const bad of [null, '', 'abc12', 'g645cda', '--help', '../x/y', 'a'.repeat(41)]) {
      assert.throws(() => commitShaFrom(bad), BadRequest, String(bad));
    }
  });
});

describe('commitDiffOf', () => {
  it('carries a small diff whole', () => {
    const diff = 'diff --git a/x b/x\n+one\n';
    assert.deepEqual(commitDiffOf('abc1234', { diff, fetchedAt: FETCHED }), {
      sha: 'abc1234',
      diff,
      diffBytes: diff.length,
      diffTruncated: false,
      diffHidden: false,
      fetchedAt: FETCHED,
    });
  });

  it('cuts a huge diff to fit, saying so and keeping its full size', () => {
    const diff = `diff --git a/x b/x\n${'+line\n'.repeat(DETAIL_LIMIT_BYTES / 4)}`;
    const commit = commitDiffOf('abc1234', { diff, fetchedAt: FETCHED });
    assert.equal(commit.diffTruncated, true);
    assert.equal(commit.diffBytes, diff.length);
    assert.ok(commit.diff.length < diff.length);
    assert.ok(commit.diff.endsWith('+line'));
  });
});
