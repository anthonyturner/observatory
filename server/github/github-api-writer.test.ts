import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { GitHub } from './github.ts';
import { githubApiReader } from './github-api-reader.ts';

interface Sent {
  readonly url: string;
  readonly method: string;
  readonly body: unknown;
  readonly accept: string | null;
}

/** A reader whose fetch answers each request with the next reply, recording what was asked. */
function recording(replies: readonly (object | string)[]): { github: GitHub; sent: Sent[] } {
  const sent: Sent[] = [];
  let next = 0;
  const fetch = async (url: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const headers = new Headers(init?.headers);
    sent.push({
      url: String(url),
      method: init?.method ?? 'GET',
      body: init?.body ? JSON.parse(String(init.body)) : null,
      accept: headers.get('accept'),
    });
    const reply = replies[next++] ?? {};
    return typeof reply === 'string' ? new Response(reply) : Response.json(reply);
  };
  return { github: githubApiReader({ token: 'test-token', fetch }), sent };
}

const REPO = 'me/app';
const API = 'https://api.github.com';
const pull = (fields: object) => ({ data: { repository: { pullRequest: fields } } });

describe('githubApiReader, the parts the PR screen adds', () => {
  it('reads a diff as a diff', async () => {
    const { github, sent } = recording(['diff --git a/x b/x\n']);

    assert.equal(await github.pullDiff(REPO, 7), 'diff --git a/x b/x\n');
    assert.deepEqual(sent[0], {
      url: `${API}/repos/me/app/pulls/7`,
      method: 'GET',
      body: null,
      accept: 'application/vnd.github.diff',
    });
  });

  it('reads one commit’s changes as a diff', async () => {
    const { github, sent } = recording(['diff --git a/y b/y\n']);

    assert.equal(await github.commitDiff(REPO, 'abc1234'), 'diff --git a/y b/y\n');
    assert.deepEqual(sent[0], {
      url: `${API}/repos/me/app/commits/abc1234`,
      method: 'GET',
      body: null,
      accept: 'application/vnd.github.diff',
    });
  });

  it('throws when GitHub will not produce the diff', async () => {
    const fetch = async () => new Response('too large', { status: 406 });
    const github = githubApiReader({ token: 't', fetch });
    await assert.rejects(github.pullDiff(REPO, 7), /HTTP 406/);
  });

  it('lists the repository’s labels', async () => {
    const labels = [{ name: 'bug', color: 'd73a4a' }];
    const { github } = recording([{ data: { repository: { labels: { nodes: labels } } } }]);
    assert.deepEqual(await github.repoLabels(REPO), labels);
  });

  it('edits through REST, resolving @me to the signed-in login', async () => {
    const { github, sent } = recording([{}, {}, {}, { data: { viewer: { login: 'me' } } }, {}, {}]);

    await github.editPull(REPO, 7, {
      title: 'T',
      addLabels: ['bug'],
      removeLabels: ['area:ci'],
      addAssignees: ['@me'],
      removeReviewers: ['kim'],
    });

    assert.deepEqual(
      sent.map(({ method, url, body }) => [method, url.replace(API, ''), body]),
      [
        ['PATCH', '/repos/me/app/pulls/7', { title: 'T' }],
        ['POST', '/repos/me/app/issues/7/labels', { labels: ['bug'] }],
        ['DELETE', '/repos/me/app/issues/7/labels/area%3Aci', null],
        ['POST', 'https://api.github.com/graphql'.replace(API, ''), sent[3].body],
        ['POST', '/repos/me/app/issues/7/assignees', { assignees: ['me'] }],
        ['DELETE', '/repos/me/app/pulls/7/requested_reviewers', { reviewers: ['kim'] }],
      ],
    );
  });

  it('merges pinned to the commit, and never by any other route', async () => {
    const { github, sent } = recording([{ merged: true }]);
    await github.mergePull(REPO, 7, { method: 'squash', headOid: 'f'.repeat(40) });

    assert.deepEqual(sent[0], {
      url: `${API}/repos/me/app/pulls/7/merge`,
      method: 'PUT',
      body: { merge_method: 'squash', sha: 'f'.repeat(40) },
      accept: 'application/vnd.github+json',
    });
  });

  it('reruns a workflow run’s failed jobs, and nothing else', async () => {
    const { github, sent } = recording(['']);
    await github.rerunFailedJobs(REPO, 42);

    assert.deepEqual(
      sent.map(({ method, url, body }) => [method, url, body]),
      [['POST', `${API}/repos/me/app/actions/runs/42/rerun-failed-jobs`, null]],
    );
  });

  it('reads the check history of rerun workflow runs through REST', async () => {
    const { github, sent } = recording([
      { workflow_runs: [{ id: 42, run_attempt: 2 }] },
      {
        jobs: [
          {
            name: 'e2e',
            head_sha: 'f'.repeat(40),
            conclusion: 'failure',
            completed_at: '2026-10-01T10:00:00Z',
          },
        ],
      },
    ]);

    assert.deepEqual(await github.checkHistory(REPO), [
      {
        name: 'e2e',
        sha: 'f'.repeat(40),
        conclusion: 'FAILURE',
        completedAt: '2026-10-01T10:00:00Z',
      },
    ]);
    assert.deepEqual(
      sent.map(({ method, url }) => [method, url.replace(API, '')]),
      [
        ['GET', '/repos/me/app/actions/runs?per_page=100'],
        ['GET', '/repos/me/app/actions/runs/42/jobs?filter=all&per_page=100'],
      ],
    );
  });

  it('marks a draft ready through its node id', async () => {
    const { github, sent } = recording([pull({ id: 'PR_1' }), { data: {} }]);
    await github.markReady(REPO, 7);

    assert.deepEqual((sent[1].body as { variables: unknown }).variables, { id: 'PR_1' });
  });

  it('reads a pull request as it stands before changing it', async () => {
    const live = {
      state: 'OPEN',
      isDraft: false,
      headRefOid: 'f'.repeat(40),
      mergeable: 'MERGEABLE',
    };
    const { github } = recording([pull(live)]);
    assert.deepEqual(await github.livePull(REPO, 7), live);
  });
});
