import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { CheckAttempt, CheckHistoryReader } from '../github/check-history.ts';
import type { QueuePull, QueueReader } from '../github/queue-reader.ts';
import { queueItemOf, queueReport } from './queue-report.ts';

const NOW = Date.parse('2026-09-26T12:00:00Z');
const DAY = 86_400_000;
const noWait = async () => undefined;

const pull = (number: number, overrides: Partial<QueuePull> = {}): QueuePull => ({
  number,
  title: `Change ${number}`,
  url: `https://github.com/me/a/pull/${number}`,
  mergeable: 'MERGEABLE',
  statusCheckRollup: [],
  closingIssuesReferences: [{ number: 100 + number }],
  updatedAt: new Date(NOW - number * DAY).toISOString(),
  createdAt: new Date(NOW - 20 * DAY).toISOString(),
  isDraft: false,
  additions: 10,
  deletions: 2,
  headRefName: `feat/${number}`,
  headRefOid: 'a'.repeat(40),
  baseRefName: 'main',
  changedFiles: 3,
  ...overrides,
});

function reader(
  pulls: QueuePull[],
  settlesTo = 'MERGEABLE',
  history: () => Promise<CheckAttempt[]> = async () => [],
): QueueReader & CheckHistoryReader {
  return {
    queuePulls: async () => pulls,
    mergeableOf: async () => settlesTo,
    checkHistory: history,
  };
}

const SHA = 'c'.repeat(40);
/** e2e failed and then passed on a rerun at one commit: flaky. */
const FLAKY_E2E: CheckAttempt[] = [
  { name: 'e2e', sha: SHA, conclusion: 'FAILURE', completedAt: '2026-09-25T10:00:00Z' },
  { name: 'e2e', sha: SHA, conclusion: 'SUCCESS', completedAt: '2026-09-25T10:20:00Z' },
];

describe('queueItemOf', () => {
  it('says what the review queue shows about a pull request', () => {
    assert.deepEqual(queueItemOf(pull(3, { isDraft: true }), NOW), {
      number: 3,
      title: 'Change 3',
      url: 'https://github.com/me/a/pull/3',
      isDraft: true,
      bucket: 'unreviewed',
      closes: [103],
      failingChecks: 0,
      flakyChecks: [],
      additions: 10,
      deletions: 2,
      branch: 'feat/3',
      headSha: 'a'.repeat(40),
      base: 'main',
      mergeable: 'MERGEABLE',
      changedFiles: 3,
      updatedAt: new Date(NOW - 3 * DAY).toISOString(),
      idleDays: 3,
      ageDays: 20,
    });
  });
});

describe('queueReport', () => {
  it('ranks blocked first, then the one untouched longest', async () => {
    const report = await queueReport(
      reader([
        pull(1),
        pull(2, { closingIssuesReferences: [] }),
        pull(5),
        pull(4, { mergeable: 'CONFLICTING' }),
        pull(3, { statusCheckRollup: [{ conclusion: 'FAILURE' }] }),
      ]),
      'me/a',
      NOW,
      noWait,
    );

    assert.equal(report.repo, 'me/a');
    assert.deepEqual(
      report.items.map((item) => [item.number, item.bucket]),
      [
        [4, 'conflicted'],
        [3, 'failing'],
        [2, 'unlinked'],
        [5, 'unreviewed'],
        [1, 'unreviewed'],
      ],
    );
  });

  it('does not count a pull request failing only on flaky checks as failing', async () => {
    const report = await queueReport(
      reader(
        [
          pull(1, { statusCheckRollup: [{ name: 'e2e', conclusion: 'FAILURE' }] }),
          pull(2, {
            statusCheckRollup: [
              { name: 'e2e', conclusion: 'FAILURE' },
              { name: 'build', conclusion: 'FAILURE' },
            ],
          }),
        ],
        'MERGEABLE',
        async () => FLAKY_E2E,
      ),
      'me/a',
      NOW,
      noWait,
    );

    assert.deepEqual(
      report.items.map((item) => [item.number, item.bucket, item.failingChecks, item.flakyChecks]),
      [
        [2, 'failing', 2, ['e2e']],
        [1, 'unreviewed', 1, ['e2e']],
      ],
    );
  });

  it('reads no check history when nothing is failing', async () => {
    let reads = 0;
    await queueReport(
      reader([pull(1)], 'MERGEABLE', async () => {
        reads++;
        return FLAKY_E2E;
      }),
      'me/a',
      NOW,
      noWait,
    );

    assert.equal(reads, 0);
  });

  it('counts every failure when the check history cannot be read', async (context) => {
    context.mock.method(console, 'error', () => undefined);
    const report = await queueReport(
      reader(
        [pull(1, { statusCheckRollup: [{ name: 'e2e', conclusion: 'FAILURE' }] })],
        'MERGEABLE',
        async () => {
          throw new Error('Actions is switched off');
        },
      ),
      'me/a',
      NOW,
      noWait,
    );

    assert.equal(report.items[0].bucket, 'failing');
    assert.deepEqual(report.items[0].flakyChecks, []);
  });

  it('keeps mergeability unknown when GitHub never settles it', async () => {
    const report = await queueReport(
      reader([pull(1, { mergeable: 'UNKNOWN' })], 'UNKNOWN'),
      'me/a',
      NOW,
      noWait,
    );

    assert.equal(report.items[0].bucket, 'unknown');
  });
});
