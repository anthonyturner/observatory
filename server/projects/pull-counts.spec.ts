import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { PullRequest } from '../github/github-reader.ts';
import { bucketOf, oldestIdleDays, pullCounts, unclaimedIssues } from './pull-counts.ts';

const NOW = Date.parse('2026-09-26T12:00:00Z');
const DAY = 86_400_000;

const pull = (overrides: Partial<PullRequest> = {}): PullRequest => ({
  number: 1,
  title: 'A change',
  url: 'https://github.com/me/a/pull/1',
  mergeable: 'MERGEABLE',
  statusCheckRollup: [{ conclusion: 'SUCCESS' }],
  closingIssuesReferences: [{ number: 10 }],
  updatedAt: new Date(NOW - DAY).toISOString(),
  ...overrides,
});

describe('bucketOf', () => {
  it('puts the most urgent problem first', () => {
    assert.equal(
      bucketOf(pull({ mergeable: 'CONFLICTING', statusCheckRollup: [{ conclusion: 'FAILURE' }] })),
      'conflicted',
    );
    assert.equal(bucketOf(pull({ statusCheckRollup: [{ state: 'ERROR' }] })), 'failing');
    assert.equal(bucketOf(pull({ closingIssuesReferences: [] })), 'unlinked');
    assert.equal(bucketOf(pull()), 'unreviewed');
  });

  it('never calls unsettled mergeability healthy', () => {
    assert.equal(bucketOf(pull({ mergeable: 'UNKNOWN' })), 'unknown');
  });

  it('reads a missing check list as no failures', () => {
    assert.equal(bucketOf(pull({ statusCheckRollup: null })), 'unreviewed');
  });
});

describe('pullCounts', () => {
  it('counts each bucket and the issues nothing closes', () => {
    const counts = pullCounts(
      [
        pull({ number: 1, mergeable: 'CONFLICTING' }),
        pull({ number: 2, mergeable: 'UNKNOWN' }),
        pull({ number: 3, closingIssuesReferences: null }),
        pull({ number: 4 }),
      ],
      [10, 11, 12],
    );

    assert.deepEqual(counts, {
      conflicted: 1,
      failing: 0,
      unknown: 1,
      unlinked: 1,
      unreviewed: 1,
      unclaimed: 2,
    });
  });

  it('has no unclaimed issues when issues are switched off', () => {
    assert.equal(pullCounts([pull()], null).unclaimed, 0);
  });
});

describe('unclaimedIssues', () => {
  it('leaves out every issue an open pull request closes', () => {
    assert.equal(
      unclaimedIssues(
        [pull({ closingIssuesReferences: [{ number: 1 }, { number: 2 }] })],
        [1, 2, 3],
      ),
      1,
    );
  });
});

describe('oldestIdleDays', () => {
  it('takes the pull request untouched longest, in whole days', () => {
    const pulls = [
      pull({ updatedAt: new Date(NOW - 2.5 * DAY).toISOString() }),
      pull({ updatedAt: new Date(NOW - 9 * DAY).toISOString() }),
    ];

    assert.equal(oldestIdleDays(pulls, NOW), 9);
    assert.equal(oldestIdleDays([], NOW), 0);
  });
});
