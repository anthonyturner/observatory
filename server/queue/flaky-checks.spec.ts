import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { CheckAttempt } from '../github/check-history.ts';
import type { PullRequest } from '../github/github-reader.ts';
import { flakyCheckNames, flakyFailures } from './flaky-checks.ts';

const SHA_A = 'a'.repeat(40);
const SHA_B = 'b'.repeat(40);

const attempt = (
  name: string,
  conclusion: string,
  completedAt: string,
  sha = SHA_A,
): CheckAttempt => ({ name, sha, conclusion, completedAt });

describe('flakyCheckNames', () => {
  it('marks a check that failed and then passed on a rerun at the same commit', () => {
    const flaky = flakyCheckNames([
      attempt('e2e', 'SUCCESS', '2026-10-01T10:30:00Z'),
      attempt('e2e', 'FAILURE', '2026-10-01T10:00:00Z'),
      attempt('build', 'SUCCESS', '2026-10-01T10:00:00Z'),
    ]);

    assert.deepEqual([...flaky], ['e2e']);
  });

  it('counts a timeout as a failure', () => {
    const flaky = flakyCheckNames([
      attempt('e2e', 'TIMED_OUT', '2026-10-01T10:00:00Z'),
      attempt('e2e', 'SUCCESS', '2026-10-01T11:00:00Z'),
    ]);

    assert.deepEqual([...flaky], ['e2e']);
  });

  it('does not mark a check that passed first and failed later', () => {
    const flaky = flakyCheckNames([
      attempt('e2e', 'SUCCESS', '2026-10-01T10:00:00Z'),
      attempt('e2e', 'FAILURE', '2026-10-01T11:00:00Z'),
    ]);

    assert.equal(flaky.size, 0);
  });

  it('does not mark a check that failed on one commit and passed on another', () => {
    const flaky = flakyCheckNames([
      attempt('e2e', 'FAILURE', '2026-10-01T10:00:00Z', SHA_A),
      attempt('e2e', 'SUCCESS', '2026-10-01T11:00:00Z', SHA_B),
    ]);

    assert.equal(flaky.size, 0);
  });

  it('does not take a cancelled run for a failure', () => {
    const flaky = flakyCheckNames([
      attempt('e2e', 'CANCELLED', '2026-10-01T10:00:00Z'),
      attempt('e2e', 'SUCCESS', '2026-10-01T11:00:00Z'),
    ]);

    assert.equal(flaky.size, 0);
  });

  it('marks a check flaky across pull requests: one rerun is enough', () => {
    const flaky = flakyCheckNames([
      attempt('lint', 'FAILURE', '2026-10-01T10:00:00Z', SHA_A),
      attempt('lint', 'FAILURE', '2026-10-01T10:05:00Z', SHA_B),
      attempt('lint', 'SUCCESS', '2026-10-01T10:10:00Z', SHA_B),
    ]);

    assert.deepEqual([...flaky], ['lint']);
  });

  it('finds nothing in no history', () => {
    assert.equal(flakyCheckNames([]).size, 0);
  });
});

describe('flakyFailures', () => {
  const pull = (checks: PullRequest['statusCheckRollup']): PullRequest => ({
    number: 1,
    title: 'Change',
    url: 'https://github.com/me/app/pull/1',
    mergeable: 'MERGEABLE',
    statusCheckRollup: checks,
    closingIssuesReferences: [],
    updatedAt: '2026-10-01T00:00:00Z',
  });

  it('names the failing checks that are known to be flaky', () => {
    const failures = flakyFailures(
      pull([
        { name: 'e2e', conclusion: 'FAILURE' },
        { name: 'build', conclusion: 'FAILURE' },
        { name: 'lint', conclusion: 'SUCCESS' },
        { context: 'ci/legacy', state: 'ERROR' },
      ]),
      new Set(['e2e', 'lint', 'ci/legacy']),
    );

    assert.deepEqual(failures, ['e2e', 'ci/legacy']);
  });
});
