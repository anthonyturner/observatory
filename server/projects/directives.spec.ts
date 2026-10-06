import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { topDirectives } from './directives.ts';
import type { Directive } from './project-types.ts';
import type { PullBucket } from './pull-counts.ts';

const directive = (number: number, bucket: PullBucket, updatedAt: string): Directive => ({
  project: 'alpha',
  number,
  title: `PR ${number}`,
  url: `https://github.com/me/alpha/pull/${number}`,
  bucket,
  updatedAt,
});

describe('topDirectives', () => {
  it('puts the most urgent state first, then the pull request untouched longest', () => {
    const top = topDirectives([
      directive(1, 'unreviewed', '2026-09-01T00:00:00Z'),
      directive(2, 'failing', '2026-09-25T00:00:00Z'),
      directive(3, 'conflicted', '2026-09-20T00:00:00Z'),
      directive(4, 'failing', '2026-09-10T00:00:00Z'),
    ]);

    assert.deepEqual(
      top.map((each) => each.number),
      [3, 4, 2],
    );
  });

  it('never returns more than it was asked for, and copes with fewer', () => {
    assert.equal(topDirectives([directive(1, 'unlinked', '2026-09-01T00:00:00Z')]).length, 1);
    assert.deepEqual(topDirectives([]), []);
  });
});
