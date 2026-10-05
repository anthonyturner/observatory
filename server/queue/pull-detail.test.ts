import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { RawPull } from '../github/pull-reader.ts';
import { BadRequest } from '../http/api-handler.ts';
import { checkLinesOf, outcomeOf, pullDetailOf, pullNumberFrom } from './pull-detail.ts';

const raw: RawPull = {
  number: 58,
  title: 'Replace the facade',
  body: 'Closes #57',
  url: 'https://github.com/me/a/pull/58',
  state: 'OPEN',
  isDraft: true,
  mergeable: 'CONFLICTING',
  author: { login: 'anthony' },
  headRefName: 'refactor/57',
  baseRefName: 'main',
  headRefOid: 'b2b767f94b7a8acb0e88d0cc7ec9c3023b0329be',
  labels: [{ name: 'area:dashboard', color: '1d76db' }],
  assignees: [{ login: 'anthony' }],
  reviewDecision: 'CHANGES_REQUESTED',
  reviewRequests: [{ login: 'sam' }, { name: 'core-team' }],
  latestReviews: [{ author: { login: 'kim' }, state: 'CHANGES_REQUESTED' }],
  statusCheckRollup: [
    {
      __typename: 'CheckRun',
      workflowName: 'CI',
      name: 'Build',
      conclusion: 'SUCCESS',
      detailsUrl: 'https://github.com/x/1',
    },
    {
      __typename: 'CheckRun',
      workflowName: 'CI',
      name: 'Test',
      conclusion: 'FAILURE',
      detailsUrl: 'https://github.com/x/2',
    },
    {
      __typename: 'StatusContext',
      context: 'deploy',
      state: 'PENDING',
      targetUrl: 'https://vercel.com/x',
    },
  ],
  closingIssuesReferences: [{ number: 57 }],
  additions: 96,
  deletions: 95,
  changedFiles: 4,
  files: [{ path: 'src/a.ts', additions: 90, deletions: 95, changeType: 'MODIFIED' }],
  commits: [
    {
      oid: '5f0d0ccf681704ba3da2fa65bcda258add87f98d',
      messageHeadline: 'chore: start',
      committedDate: '2026-07-30T05:00:00Z',
      authoredDate: '2026-07-30T04:00:00Z',
      authors: [
        { login: 'anthony', name: 'Anthony' },
        { login: '', name: 'A Bot' },
      ],
    },
  ],
  createdAt: '2026-07-30T05:16:37Z',
  updatedAt: '2026-07-30T05:16:46Z',
};

const extras = { diff: 'diff --git a/src/a.ts b/src/a.ts\n', fetchedAt: '2026-09-26T10:00:00Z' };

describe('pullDetailOf', () => {
  it('says what the PR screen shows', () => {
    const detail = pullDetailOf(raw, extras);

    assert.equal(detail.bucket, 'conflicted');
    assert.equal(detail.author, 'anthony');
    assert.deepEqual([detail.head, detail.base], ['refactor/57', 'main']);
    assert.deepEqual(detail.labels, [{ name: 'area:dashboard', color: '1d76db' }]);
    assert.deepEqual(detail.closes, [57]);
    assert.equal(detail.reviewDecision, 'changes-requested');
    assert.deepEqual(detail.requestedReviewers, ['sam', 'core-team']);
    assert.deepEqual(detail.reviews, [{ reviewer: 'kim', state: 'changes requested' }]);
  });

  it('carries what the screen’s tabs show, and when it was read', () => {
    const detail = pullDetailOf(raw, extras);

    assert.equal(detail.headOid, raw.headRefOid);
    assert.equal(detail.mergeable, 'CONFLICTING');
    assert.deepEqual(detail.assignees, ['anthony']);
    assert.deepEqual(detail.files, [
      { path: 'src/a.ts', additions: 90, deletions: 95, change: 'MODIFIED' },
    ]);
    assert.deepEqual(detail.commits, [
      {
        oid: '5f0d0cc',
        headline: 'chore: start',
        date: '2026-07-30T05:00:00Z',
        authors: ['anthony', 'A Bot'],
      },
    ]);
    assert.equal(detail.commitsTotal, 1);
    assert.deepEqual(
      [detail.diff, detail.diffBytes, detail.diffTruncated, detail.bodyTruncated],
      [extras.diff, extras.diff.length, false, false],
    );
    assert.equal(detail.fetchedAt, extras.fetchedAt);
  });

  it('says whether it is open, merged or closed, reading anything else as open', () => {
    const states = ['OPEN', 'MERGED', 'CLOSED', ''].map(
      (state) => pullDetailOf({ ...raw, state }, extras).state,
    );

    assert.deepEqual(states, ['open', 'merged', 'closed', 'open']);
  });

  it('keeps the latest fifty commits and counts them all', () => {
    const commit = raw.commits![0];
    const commits = Array.from({ length: 60 }, (_, i) => ({ ...commit, messageHeadline: `c${i}` }));
    const detail = pullDetailOf({ ...raw, commits }, extras);

    assert.equal(detail.commits.length, 50);
    assert.equal(detail.commits[0].headline, 'c10');
    assert.equal(detail.commitsTotal, 60);
  });

  it('reads an empty decision, a missing author and a null body as nothing', () => {
    const detail = pullDetailOf(
      { ...raw, reviewDecision: '', author: null, body: null as unknown as string },
      extras,
    );

    assert.equal(detail.reviewDecision, 'none');
    assert.equal(detail.author, null);
    assert.equal(detail.body, '');
  });
});

describe('checkLinesOf', () => {
  it('names each check both ways, in the order GitHub lists them', () => {
    assert.deepEqual(checkLinesOf(raw.statusCheckRollup), [
      {
        name: 'CI / Build',
        run: 'Build',
        outcome: 'passed',
        result: 'SUCCESS',
        url: 'https://github.com/x/1',
      },
      {
        name: 'CI / Test',
        run: 'Test',
        outcome: 'failed',
        result: 'FAILURE',
        url: 'https://github.com/x/2',
      },
      {
        name: 'deploy',
        run: 'deploy',
        outcome: 'pending',
        result: 'PENDING',
        url: 'https://vercel.com/x',
      },
    ]);
  });

  it('reads an unfinished run as pending and a skipped one as skipped', () => {
    assert.equal(outcomeOf({ status: 'IN_PROGRESS', conclusion: null }), 'pending');
    assert.equal(outcomeOf({ conclusion: 'SKIPPED' }), 'skipped');
    assert.equal(outcomeOf({ conclusion: 'TIMED_OUT' }), 'failed');
  });
});

describe('pullNumberFrom', () => {
  it('accepts a pull request number and refuses anything else', () => {
    assert.equal(pullNumberFrom('58'), 58);
    assert.equal(pullNumberFrom(58), 58);
    for (const bad of [null, '', '0', '-1', '5e3', '12abc', '9999999999', 1.5, true]) {
      assert.throws(() => pullNumberFrom(bad), BadRequest, String(bad));
    }
  });
});
