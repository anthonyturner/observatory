import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { RawPull } from '../github/pull-reader.ts';
import { BadRequest } from '../http/api-server.ts';
import { checkLinesOf, outcomeOf, pullDetailOf, pullNumberFrom } from './pull-detail.ts';

const raw: RawPull = {
  number: 58,
  title: 'Replace the facade',
  body: 'Closes #57',
  url: 'https://github.com/me/a/pull/58',
  isDraft: true,
  mergeable: 'CONFLICTING',
  author: { login: 'anthony' },
  headRefName: 'refactor/57',
  baseRefName: 'main',
  labels: [{ name: 'area:dashboard' }],
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
  createdAt: '2026-07-30T05:16:37Z',
  updatedAt: '2026-07-30T05:16:46Z',
};

describe('pullDetailOf', () => {
  it('says what the PR screen shows', () => {
    const detail = pullDetailOf(raw);

    assert.equal(detail.bucket, 'conflicted');
    assert.equal(detail.author, 'anthony');
    assert.deepEqual([detail.head, detail.base], ['refactor/57', 'main']);
    assert.deepEqual(detail.labels, ['area:dashboard']);
    assert.deepEqual(detail.closes, [57]);
    assert.equal(detail.reviewDecision, 'changes-requested');
    assert.deepEqual(detail.requestedReviewers, ['sam', 'core-team']);
    assert.deepEqual(detail.reviews, [{ reviewer: 'kim', state: 'changes requested' }]);
  });

  it('reads an empty decision, a missing author and a null body as nothing', () => {
    const detail = pullDetailOf({
      ...raw,
      reviewDecision: '',
      author: null,
      body: null as unknown as string,
    });

    assert.equal(detail.reviewDecision, 'none');
    assert.equal(detail.author, null);
    assert.equal(detail.body, '');
  });
});

describe('checkLinesOf', () => {
  it('names each check and puts failures first, then pending', () => {
    assert.deepEqual(checkLinesOf(raw.statusCheckRollup), [
      { name: 'CI / Test', outcome: 'failed', url: 'https://github.com/x/2' },
      { name: 'deploy', outcome: 'pending', url: 'https://vercel.com/x' },
      { name: 'CI / Build', outcome: 'passed', url: 'https://github.com/x/1' },
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
    for (const bad of [null, '', '0', '-1', '5e3', '12abc', '9999999999']) {
      assert.throws(() => pullNumberFrom(bad), BadRequest, String(bad));
    }
  });
});
