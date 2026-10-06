import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { IssueReader, RawIssue } from '../github/issue-reader.ts';
import { dayBefore, issueRowOf, issuesReport, openedBy } from './issues-report.ts';

const NOW = Date.parse('2026-09-26T12:00:00Z');
const DAY = 86_400_000;
const url = (kind: string, number: number, repo = 'me/a'): string =>
  `https://github.com/${repo}/${kind}/${number}`;
const ago = (days: number): string => new Date(NOW - days * DAY).toISOString();

const issue = (number: number, fields: Partial<RawIssue> = {}): RawIssue => ({
  number,
  title: `Issue ${number}`,
  url: url('issues', number),
  labels: [{ name: 'bug', color: 'd73a4a' }],
  assignees: [],
  author: { login: 'me' },
  createdAt: ago(40),
  updatedAt: ago(2),
  closedAt: null,
  stateReason: '',
  closedByPullRequestsReferences: [],
  ...fields,
});

describe('openedBy', () => {
  it('maps each issue by URL to every open pull request that closes it', () => {
    const map = openedBy([
      { number: 7, closingIssuesReferences: [{ number: 1, url: url('issues', 1) }] },
      { number: 9, closingIssuesReferences: [{ number: 1, url: url('issues', 1) }] },
      { number: 10, closingIssuesReferences: [{ number: 1, url: url('issues', 1, 'other/b') }] },
      { number: 11, closingIssuesReferences: null },
    ]);

    assert.deepEqual(map.get(url('issues', 1)), [7, 9]);
    assert.deepEqual(map.get(url('issues', 1, 'other/b')), [10]);
  });
});

describe('issueRowOf', () => {
  it('links its own pull requests, open or not, and leaves other repositories out', () => {
    const row = issueRowOf(
      issue(3, {
        closedByPullRequestsReferences: [
          { number: 2, url: url('pull', 2) },
          { number: 8, url: url('pull', 8, 'other/b') },
        ],
      }),
      new Map([[url('issues', 3), [5]]]),
    );

    assert.deepEqual(row.prs, [2, 5]);
    assert.equal(row.comet, false);
    assert.equal(row.author, 'me');
    assert.equal('stateReason' in row, false);
  });

  it('marks an open issue no open pull request closes as a comet', () => {
    const row = issueRowOf(
      issue(4, { closedByPullRequestsReferences: [{ number: 2, url: url('pull', 2) }] }),
      new Map(),
    );

    assert.equal(row.comet, true);
    assert.deepEqual(row.prs, [2]);
  });

  it('keeps how a closed issue closed, and a deleted author as null', () => {
    const row = issueRowOf(
      issue(5, { closedAt: ago(1), stateReason: 'NOT_PLANNED', author: null }),
      new Map(),
    );

    assert.equal(row.stateReason, 'NOT_PLANNED');
    assert.equal(row.author, null);
    assert.equal('comet' in row, false);
  });

  it('shortens a very long title as pr-starmap does', () => {
    const row = issueRowOf(issue(6, { title: 'x'.repeat(250) }), new Map());

    assert.equal(row.title.length, 200);
    assert.equal(row.title.endsWith('…'), true);
  });
});

describe('issuesReport', () => {
  it('lists open issues by last touch and closed ones by close, within 60 days', async () => {
    let askedSince = '';
    const github: IssueReader = {
      openIssues: async () => [
        issue(1, { updatedAt: ago(5) }),
        issue(2, { updatedAt: ago(1) }),
        issue(3, { updatedAt: ago(9) }),
      ],
      closedIssues: async (_repo, since) => {
        askedSince = since;
        return [
          issue(10, { closedAt: ago(20), stateReason: 'COMPLETED' }),
          issue(11, { closedAt: ago(3), stateReason: 'COMPLETED' }),
          issue(12, { closedAt: ago(60.5), stateReason: 'COMPLETED' }),
        ];
      },
      closingPulls: async () => [
        { number: 50, closingIssuesReferences: [{ number: 3, url: url('issues', 3) }] },
      ],
    };

    const report = await issuesReport(github, 'me/a', NOW);

    assert.equal(askedSince, '2026-07-28');
    assert.deepEqual(
      report.open.map((row) => [row.number, row.comet]),
      [
        [2, true],
        [1, true],
        [3, false],
      ],
    );
    assert.deepEqual(
      report.closed.map((row) => row.number),
      [11, 10],
    );
    assert.deepEqual(report.total, { open: 3, closed: 2, comets: 2 });
    assert.equal(report.days, 60);
    assert.equal(report.repo, 'me/a');
  });
});

describe('dayBefore', () => {
  it('gives the day a number of days earlier, as a date', () => {
    assert.equal(dayBefore(NOW, 30), '2026-08-27');
  });
});
