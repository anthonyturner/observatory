import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { GitHubReader, PullRequest, RepoRef } from './github-reader.ts';

const run = promisify(execFile);

/** Enough for any list `gh` returns here; its default is 1 MB. */
const MAX_OUTPUT_BYTES = 64 * 1024 * 1024;
const PULL_LIMIT = '100';
const ISSUE_LIMIT = '1000';
const REPO_LIMIT = '1000';
const PULL_FIELDS = 'number,mergeable,statusCheckRollup,closingIssuesReferences,updatedAt';

async function gh(args: readonly string[]): Promise<string> {
  const { stdout } = await run('gh', [...args], { encoding: 'utf8', maxBuffer: MAX_OUTPUT_BYTES });
  return stdout;
}

const ghJson = async <T>(args: readonly string[]): Promise<T> => JSON.parse(await gh(args)) as T;

/** A repository with issues switched off answers `gh issue list` with this. */
const ISSUES_DISABLED = /has disabled issues/i;

/** GitHub through the `gh` CLI, as the account this machine signed it in with. */
export function ghCliReader(): GitHubReader {
  return {
    viewer: async () => (await gh(['api', 'user', '--jq', '.login'])).trim(),
    ownedRepos: (owner) =>
      ghJson<RepoRef[]>([
        'repo',
        'list',
        owner,
        '--source',
        '--no-archived',
        '--limit',
        REPO_LIMIT,
        '--json',
        'name,nameWithOwner',
      ]),
    openPulls: (repo) =>
      ghJson<PullRequest[]>([
        'pr',
        'list',
        '--repo',
        repo,
        '--state',
        'open',
        '--limit',
        PULL_LIMIT,
        '--json',
        PULL_FIELDS,
      ]),
    mergeableOf: async (repo, pull) =>
      (
        await ghJson<{ mergeable: string }>([
          'pr',
          'view',
          String(pull),
          '--repo',
          repo,
          '--json',
          'mergeable',
        ])
      ).mergeable,
    openIssueNumbers: async (repo) => {
      try {
        const issues = await ghJson<{ number: number }[]>([
          'issue',
          'list',
          '--repo',
          repo,
          '--state',
          'open',
          '--limit',
          ISSUE_LIMIT,
          '--json',
          'number',
        ]);
        return issues.map((issue) => issue.number);
      } catch (error) {
        if (ISSUES_DISABLED.test(String((error as { stderr?: string }).stderr ?? error)))
          return null;
        throw error;
      }
    },
  };
}
