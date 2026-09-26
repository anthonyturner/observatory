import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import type { GitHub } from './github.ts';
import { githubApiReader } from './github-api-reader.ts';

/** GraphQL replies recorded from GitHub, and what `gh --json` answered at the same moment. */
interface Recording {
  readonly replies: readonly unknown[];
  readonly expected: unknown;
}

const recording = (name: string): Recording =>
  JSON.parse(
    readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url), 'utf8'),
  ) as Recording;

interface Sent {
  readonly query: string;
  readonly variables: Readonly<Record<string, unknown>>;
  readonly authorization: string | null;
}

/** A reader whose fetch answers with `replies` in turn, recording what was asked. */
function replaying(replies: readonly unknown[]): { reader: GitHub; sent: Sent[] } {
  const sent: Sent[] = [];
  let next = 0;
  const fetch = async (_url: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const body = JSON.parse(String(init?.body)) as Omit<Sent, 'authorization'>;
    sent.push({ ...body, authorization: new Headers(init?.headers).get('authorization') });
    return Response.json(replies[next++]);
  };
  return { reader: githubApiReader({ token: 'test-token', fetch }), sent };
}

const REPO = 'anthonyturner/jobpilot';

/** Each case replays one recording and must answer what `gh` answered. */
const RECORDED: readonly [string, (reader: GitHub) => Promise<unknown>][] = [
  ['queue-pulls', (reader) => reader.queuePulls(REPO)],
  ['open-pulls', (reader) => reader.openPulls(REPO)],
  ['closing-pulls', (reader) => reader.closingPulls(REPO)],
  ['pull-files', (reader) => reader.pullFiles(REPO)],
  ['pull-detail', (reader) => reader.pullDetail(REPO, 16)],
  ['pull-detail-bot', (reader) => reader.pullDetail('anthonyturner/observatory', 1)],
  ['pull-state', (reader) => reader.pullState(REPO, 16)],
  ['mergeable', (reader) => reader.mergeableOf(REPO, 16)],
  ['open-issues', (reader) => reader.openIssues(REPO)],
  ['open-issue-numbers', (reader) => reader.openIssueNumbers(REPO)],
  ['closed-issues', (reader) => reader.closedIssues(REPO, '2026-07-28')],
  ['viewer', (reader) => reader.viewer()],
];

describe('githubApiReader against recorded GitHub replies', () => {
  for (const [name, call] of RECORDED) {
    it(`answers ${name} exactly as gh did`, async () => {
      const { replies, expected } = recording(name);
      const { reader, sent } = replaying(replies);

      assert.deepEqual(await call(reader), expected);
      assert.equal(sent[0].authorization, 'Bearer test-token');
    });
  }

  it('searches for closed issues as gh issue list --search does', async () => {
    const { reader, sent } = replaying(recording('closed-issues').replies);

    await reader.closedIssues(REPO, '2026-07-28');

    assert.equal(
      sent[0].variables['query'],
      '( closed:>=2026-07-28 ) repo:anthonyturner/jobpilot state:closed type:issue',
    );
  });
});

describe('githubApiReader where GitHub has no recording to replay', () => {
  it('reads every page of repositories, keeping whether each is private', async () => {
    const page = (names: string[], next: string | null) => ({
      data: {
        repositoryOwner: {
          repositories: {
            pageInfo: { hasNextPage: next !== null, endCursor: next },
            nodes: names.map((name) => ({
              name,
              nameWithOwner: `me/${name}`,
              isPrivate: name === 'secret',
            })),
          },
        },
      },
    });
    const { reader, sent } = replaying([page(['app'], 'c1'), page(['secret'], null)]);

    assert.deepEqual(await reader.ownedRepos('me'), [
      { name: 'app', nameWithOwner: 'me/app', isPrivate: false },
      { name: 'secret', nameWithOwner: 'me/secret', isPrivate: true },
    ]);
    assert.equal(sent[1].variables['after'], 'c1');
  });

  it('says so when the owner does not exist', async () => {
    const { reader } = replaying([{ data: { repositoryOwner: null } }]);

    await assert.rejects(reader.ownedRepos('nobody'), /no account called nobody/);
  });

  it('reads a repository with issues switched off as gh does', async () => {
    const off = { data: { repository: { hasIssuesEnabled: false, issues: { nodes: [] } } } };

    assert.equal(await replaying([off]).reader.openIssueNumbers(REPO), null);
    await assert.rejects(replaying([off]).reader.openIssues(REPO), /has disabled issues/);
  });

  it('shapes a commit status, an unfinished check and a team reviewer like gh', async () => {
    const { reader } = replaying([
      {
        data: {
          repository: {
            pullRequest: {
              reviewDecision: null,
              reviewRequests: {
                nodes: [{ requestedReviewer: { __typename: 'Team', name: 'Core', slug: 'core' } }],
              },
              statusCheckRollup: {
                nodes: [
                  {
                    commit: {
                      statusCheckRollup: {
                        contexts: {
                          nodes: [
                            {
                              __typename: 'StatusContext',
                              context: 'ci/legacy',
                              state: 'FAILURE',
                              targetUrl: null,
                              createdAt: '2026-09-01T00:00:00Z',
                            },
                            {
                              __typename: 'CheckRun',
                              name: 'build',
                              status: 'IN_PROGRESS',
                              conclusion: null,
                              startedAt: '2026-09-01T00:00:00Z',
                              completedAt: null,
                              detailsUrl: 'https://ci.example/1',
                              checkSuite: { workflowRun: null },
                            },
                          ],
                        },
                      },
                    },
                  },
                ],
              },
            },
          },
        },
      },
    ]);

    const pull = await reader.pullDetail(REPO, 3);

    assert.equal(pull.reviewDecision, '');
    assert.deepEqual(pull.reviewRequests, [{ __typename: 'Team', name: 'Core', slug: 'core' }]);
    assert.deepEqual(pull.statusCheckRollup, [
      {
        __typename: 'StatusContext',
        context: 'ci/legacy',
        startedAt: '2026-09-01T00:00:00Z',
        state: 'FAILURE',
        targetUrl: '',
      },
      {
        __typename: 'CheckRun',
        completedAt: null,
        conclusion: '',
        detailsUrl: 'https://ci.example/1',
        name: 'build',
        startedAt: '2026-09-01T00:00:00Z',
        status: 'IN_PROGRESS',
        workflowName: '',
      },
    ]);
  });

  it('refuses a pull request that is not there', async () => {
    const { reader } = replaying([{ data: { repository: { pullRequest: null } } }]);

    await assert.rejects(reader.pullState(REPO, 404), /has no pull request 404/);
  });

  it('reads every page of closed issues', async () => {
    const page = (numbers: number[], next: string | null) => ({
      data: {
        search: {
          pageInfo: { hasNextPage: next !== null, endCursor: next },
          nodes: numbers.map((number) => ({ number })),
        },
      },
    });
    const { reader, sent } = replaying([page([9], 'c1'), page([4], null)]);

    const numbers = (await reader.closedIssues(REPO, '2026-07-28')).map((issue) => issue.number);

    assert.deepEqual(numbers, [9, 4]);
    assert.equal(sent[1].variables['after'], 'c1');
  });
});
