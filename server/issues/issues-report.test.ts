import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { IssueReader, RawIssue } from '../github/issue-reader.ts';
import { dayBefore, issuesReport, pullsByIssue } from './issues-report.ts';

const NOW = Date.parse('2026-09-26T12:00:00Z');
const DAY = 86_400_000;

const issue = (number: number, idleDays: number): RawIssue => ({
  number,
  title: `Issue ${number}`,
  url: `https://github.com/me/a/issues/${number}`,
  labels: [{ name: 'bug' }],
  assignees: [],
  createdAt: new Date(NOW - 40 * DAY).toISOString(),
  updatedAt: new Date(NOW - idleDays * DAY).toISOString(),
});

describe('pullsByIssue', () => {
  it('maps each issue to every open pull request that closes it', () => {
    const map = pullsByIssue([
      { number: 7, closingIssuesReferences: [{ number: 1 }, { number: 2 }] },
      { number: 9, closingIssuesReferences: [{ number: 1 }] },
      { number: 10, closingIssuesReferences: null },
    ]);

    assert.deepEqual(map.get(1), [7, 9]);
    assert.deepEqual(map.get(2), [7]);
    assert.equal(map.has(10), false);
  });
});

describe('issuesReport', () => {
  it('puts nobody-on-it first, the idlest first, and counts what closed recently', async () => {
    let askedSince = '';
    const github: IssueReader = {
      openIssues: async () => [issue(1, 2), issue(2, 30), issue(3, 5), issue(4, 1)],
      closingPulls: async () => [{ number: 50, closingIssuesReferences: [{ number: 3 }] }],
      closedSinceCount: async (_repo, since) => {
        askedSince = since;
        return 6;
      },
    };

    const report = await issuesReport(github, 'me/a', NOW);

    assert.deepEqual(
      report.items.map((item) => [item.number, item.pulls]),
      [
        [2, []],
        [1, []],
        [4, []],
        [3, [50]],
      ],
    );
    assert.equal(report.closedRecently, 6);
    assert.equal(askedSince, '2026-08-27');
    assert.deepEqual(report.items[0].labels, ['bug']);
    assert.equal(report.items[0].idleDays, 30);
  });
});

describe('dayBefore', () => {
  it('gives the day a number of days earlier, as a date', () => {
    assert.equal(dayBefore(NOW, 30), '2026-08-27');
  });
});
