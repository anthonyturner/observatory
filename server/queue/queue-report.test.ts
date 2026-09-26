import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
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
  baseRefName: 'main',
  changedFiles: 3,
  ...overrides,
});

function reader(pulls: QueuePull[], settlesTo = 'MERGEABLE'): QueueReader {
  return { queuePulls: async () => pulls, mergeableOf: async () => settlesTo };
}

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
      additions: 10,
      deletions: 2,
      branch: 'feat/3',
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
