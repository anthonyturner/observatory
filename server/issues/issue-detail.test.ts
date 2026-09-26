import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { RawIssueDetail } from '../github/issue-reader.ts';
import { issueDetail } from './issue-detail.ts';

const NOW = Date.parse('2026-09-26T12:00:00Z');

const raw = (body: string): RawIssueDetail => ({
  number: 9,
  title: 't'.repeat(250),
  url: 'https://github.com/me/a/issues/9',
  labels: [],
  assignees: [{ login: 'ann' }],
  author: { login: 'me' },
  createdAt: '2026-09-01T00:00:00Z',
  updatedAt: '2026-09-20T00:00:00Z',
  closedAt: null,
  stateReason: '',
  closedByPullRequestsReferences: [],
  body,
});

const github = (body: string) => ({
  issueDetail: async () => raw(body),
  closingPulls: async () => [
    {
      number: 4,
      closingIssuesReferences: [{ number: 9, url: 'https://github.com/me/a/issues/9' }],
    },
  ],
  openIssues: async () => [],
  closedIssues: async () => [],
});

describe('issueDetail', () => {
  it('is the list’s row with the full title, the description and when it was read', async () => {
    const detail = await issueDetail(github('Steps to reproduce'), 'me/a', 9, NOW);

    assert.equal(detail.title.length, 250);
    assert.equal(detail.body, 'Steps to reproduce');
    assert.equal(detail.bodyTruncated, false);
    assert.deepEqual(detail.prs, [4]);
    assert.equal(detail.comet, false);
    assert.equal(detail.fetchedAt, '2026-09-26T12:00:00.000Z');
  });

  it('cuts a very long description and says so', async () => {
    const detail = await issueDetail(github('x'.repeat(70_000)), 'me/a', 9, NOW);

    assert.equal(detail.body.length, 60 * 1024);
    assert.equal(detail.bodyTruncated, true);
  });
});
