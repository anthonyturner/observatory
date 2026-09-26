import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { GitHubReader, PullRequest } from '../github/github-reader.ts';
import { projectsReport } from './projects-report.ts';

const NOW = Date.parse('2026-09-26T12:00:00Z');
const noWait = async () => undefined;

const pull = (number: number, mergeable: string, closes: number[] = [1]): PullRequest => ({
  number,
  title: `Change ${number}`,
  url: `https://github.com/me/alpha/pull/${number}`,
  mergeable,
  statusCheckRollup: [],
  closingIssuesReferences: closes.map((issue) => ({ number: issue })),
  updatedAt: new Date(NOW - 3 * 86_400_000).toISOString(),
});

function fakeGitHub(overrides: Partial<GitHubReader> = {}): GitHubReader & { asked: number[] } {
  const asked: number[] = [];
  return {
    asked,
    viewer: async () => 'me',
    ownedRepos: async () => [
      { name: 'alpha', nameWithOwner: 'me/alpha' },
      { name: 'beta', nameWithOwner: 'me/beta' },
    ],
    openPulls: async (repo) =>
      repo === 'me/alpha' ? [pull(1, 'UNKNOWN'), pull(2, 'MERGEABLE', [])] : [],
    mergeableOf: async (_repo, number) => {
      asked.push(number);
      return 'CONFLICTING';
    },
    openIssueNumbers: async (repo) => (repo === 'me/alpha' ? [1, 5, 6] : null),
    ...overrides,
  };
}

describe('projectsReport', () => {
  it('reads every owned repository into a snapshot', async () => {
    const github = fakeGitHub();

    const { projects } = await projectsReport(github, NOW, noWait);
    const [alpha, beta] = projects;

    assert.deepEqual(alpha, {
      name: 'alpha',
      repo: 'me/alpha',
      dashboardUrl: '/p/me/alpha',
      open: 2,
      counts: { conflicted: 1, failing: 0, unknown: 0, unlinked: 1, unreviewed: 0, unclaimed: 2 },
      issues: 3,
      oldestIdleDays: 3,
    });
    assert.deepEqual(github.asked, [1]);
    assert.equal(beta.issues, undefined);
  });

  it('keeps mergeability unknown when GitHub never settles it', async () => {
    const github = fakeGitHub({ mergeableOf: async () => 'UNKNOWN' });

    const { projects } = await projectsReport(github, NOW, noWait);

    assert.equal(projects[0].counts.unknown, 1);
  });

  it('marks a repository it cannot read as unreadable, with the reason', async () => {
    const github = fakeGitHub({
      openPulls: async (repo) => {
        if (repo === 'me/beta') throw new Error('HTTP 403: rate limit exceeded\nmore detail');
        return [];
      },
    });

    const { projects } = await projectsReport(github, NOW, noWait);

    assert.equal(projects[1].error, 'HTTP 403: rate limit exceeded');
    assert.equal(projects[1].open, 0);
  });

  it('names the most urgent pull requests across every project', async () => {
    const { directives } = await projectsReport(fakeGitHub(), NOW, noWait);

    assert.deepEqual(
      directives.map((each) => [each.project, each.number, each.bucket]),
      [
        ['alpha', 1, 'conflicted'],
        ['alpha', 2, 'unlinked'],
      ],
    );
    assert.equal(directives[0].url, 'https://github.com/me/alpha/pull/1');
  });
});
