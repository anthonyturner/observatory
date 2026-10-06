import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  type LedgerPull,
  ledgerReport,
  ledgerRows,
  localDay,
  mergedBranchesOf,
} from './ledger.ts';

const NOW = new Date(2026, 8, 26, 15, 0).getTime();
const DAY = 86_400_000;
const at = (daysAgo: number): string => new Date(NOW - daysAgo * DAY).toISOString();

const pull = (number: number, extra: Partial<LedgerPull>): LedgerPull => ({
  number,
  title: `Change ${number}`,
  createdAt: at(20),
  closedAt: null,
  mergedAt: null,
  state: 'OPEN',
  headRefName: `feat/${number}`,
  baseRefName: 'main',
  isCrossRepository: false,
  ...extra,
});

describe('mergedBranchesOf', () => {
  const merged = (number: number, extra: Partial<LedgerPull> = {}): LedgerPull =>
    pull(number, { state: 'MERGED', mergedAt: at(1), closedAt: at(1), ...extra });

  it('lists each merge with its branches, newest first', () => {
    const branches = mergedBranchesOf([
      merged(3),
      merged(8, { baseRefName: 'feat/3', mergedAt: at(2), closedAt: at(2) }),
    ]);

    assert.deepEqual(branches, [
      { number: 8, head: 'feat/8', base: 'feat/3' },
      { number: 3, head: 'feat/3', base: 'main' },
    ]);
  });

  it('leaves out a branch that took another merge after its own, as main does after a release', () => {
    const release = merged(10, { headRefName: 'main', baseRefName: 'production', mergedAt: at(3) });

    assert.deepEqual(mergedBranchesOf([release, merged(11, { mergedAt: at(2) })]), [
      { number: 11, head: 'feat/11', base: 'main' },
    ]);
  });

  it('leaves out what is open or closed unmerged, a fork, and a merge into its own name', () => {
    const branches = mergedBranchesOf([
      pull(1, {}),
      pull(2, { state: 'CLOSED', closedAt: at(1) }),
      merged(4, { isCrossRepository: true }),
      merged(5, { headRefName: 'main' }),
      merged(6, { headRefName: '' }),
    ]);

    assert.deepEqual(branches, []);
  });
});

describe('ledgerRows', () => {
  const pulls = [
    pull(1, { createdAt: at(3) }),
    pull(2, { createdAt: at(10), mergedAt: at(2), closedAt: at(2), state: 'MERGED' }),
    pull(3, { createdAt: at(5), closedAt: at(1), state: 'CLOSED' }),
  ];

  it('keeps one row a day, ending today', () => {
    const { rows } = ledgerRows(pulls, NOW, 60);
    assert.equal(rows.length, 61);
    assert.equal(rows.at(-1)?.day, localDay(NOW));
  });

  it('places each opening, merge and unmerged close on its day, and counts what was open', () => {
    const { rows } = ledgerRows(pulls, NOW, 60);
    const day = (daysAgo: number) => rows.find((r) => r.day === localDay(NOW - daysAgo * DAY));

    assert.deepEqual(day(3)?.opened, [1]);
    assert.deepEqual(day(2)?.merged, [2]);
    assert.deepEqual(day(2)?.closed, []);
    assert.deepEqual(day(1)?.closed, [3]);
    assert.equal(day(4)?.open, 2);
    assert.equal(day(0)?.open, 1);
  });

  it('names only the pull requests the rows mention', () => {
    const { titles } = ledgerRows([...pulls, pull(9, { createdAt: at(200) })], NOW, 60);
    assert.deepEqual(Object.keys(titles).sort(), ['1', '2', '3']);
  });
});

describe('ledgerReport', () => {
  it('counts a pull request opened before the window and untouched since as open', async () => {
    const github = {
      touchedPulls: async () => [],
      queuePulls: async () => [
        {
          number: 4,
          title: 'Old',
          createdAt: at(90),
          url: '',
          mergeable: 'MERGEABLE',
          statusCheckRollup: [],
          closingIssuesReferences: [],
          updatedAt: at(90),
          isDraft: false,
          additions: 1,
          deletions: 1,
          headRefName: 'x',
          headRefOid: 'a'.repeat(40),
          baseRefName: 'main',
          changedFiles: 1,
        },
      ],
      mergeableOf: async () => 'MERGEABLE',
    };

    const ledger = await ledgerReport(github, 'me/a', NOW, 60);

    assert.ok(ledger.rows.every((row) => row.open === 1));
    assert.equal(ledger.days, 60);
    assert.deepEqual(ledger.mergedBranches, []);
  });
});
