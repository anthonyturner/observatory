import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { type ListedFiles, pullFilesOf } from './listed-files.ts';
import type { GitHub } from './github.ts';
import {
  PULL_REQUEST_FIELDS,
  type PullRequest,
  REPO_FIELDS,
  type RepoRef,
} from './github-reader.ts';
import {
  CLOSING_PULL_FIELDS,
  type ClosingPull,
  RAW_ISSUE_FIELDS,
  type RawIssue,
} from './issue-reader.ts';
import { PULL_DETAIL_FIELDS, type RawPull } from './pull-reader.ts';
import { QUEUE_PULL_FIELDS, type QueuePull } from './queue-reader.ts';
import { LEDGER_PULL_FIELDS, type LedgerPull, byNumberDescending } from '../history/ledger.ts';

const run = promisify(execFile);

/** Enough for any list `gh` returns here; its default is 1 MB. */
const MAX_OUTPUT_BYTES = 64 * 1024 * 1024;
const PULL_LIMIT = '100';
const ISSUE_LIMIT = '1000';
/** Enough for sixty days of a busy repository's pull requests. */
const LEDGER_LIMIT = '400';
const REPO_LIMIT = '1000';

async function gh(args: readonly string[]): Promise<string> {
  const { stdout } = await run('gh', [...args], { encoding: 'utf8', maxBuffer: MAX_OUTPUT_BYTES });
  return stdout;
}

const ghJson = async <T>(args: readonly string[]): Promise<T> => JSON.parse(await gh(args)) as T;

/** A repository with issues switched off answers `gh issue list` with this. */
const ISSUES_DISABLED = /has disabled issues/i;

/** GitHub through the `gh` CLI, as the account this machine signed it in with. */
export function ghCliReader(): GitHub {
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
        REPO_FIELDS.join(','),
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
        PULL_REQUEST_FIELDS.join(','),
      ]),
    queuePulls: (repo) =>
      ghJson<QueuePull[]>([
        'pr',
        'list',
        '--repo',
        repo,
        '--state',
        'open',
        '--limit',
        PULL_LIMIT,
        '--json',
        QUEUE_PULL_FIELDS.join(','),
      ]),
    openIssues: (repo) =>
      ghJson<RawIssue[]>([
        'issue',
        'list',
        '--repo',
        repo,
        '--state',
        'open',
        '--limit',
        ISSUE_LIMIT,
        '--json',
        RAW_ISSUE_FIELDS.join(','),
      ]),
    closingPulls: (repo) =>
      ghJson<ClosingPull[]>([
        'pr',
        'list',
        '--repo',
        repo,
        '--state',
        'open',
        '--limit',
        PULL_LIMIT,
        '--json',
        CLOSING_PULL_FIELDS.join(','),
      ]),
    closedIssues: (repo, sinceDay) =>
      ghJson<RawIssue[]>([
        'issue',
        'list',
        '--repo',
        repo,
        '--state',
        'closed',
        '--limit',
        ISSUE_LIMIT,
        '--search',
        `closed:>=${sinceDay}`,
        '--json',
        RAW_ISSUE_FIELDS.join(','),
      ]),
    pullDetail: (repo, number) =>
      ghJson<RawPull>([
        'pr',
        'view',
        String(number),
        '--repo',
        repo,
        '--json',
        PULL_DETAIL_FIELDS.join(','),
      ]),
    touchedPulls: async (repo, sinceDay) =>
      byNumberDescending(
        await ghJson<LedgerPull[]>([
          'pr',
          'list',
          '--repo',
          repo,
          '--state',
          'all',
          '--limit',
          LEDGER_LIMIT,
          '--search',
          `updated:>=${sinceDay}`,
          '--json',
          LEDGER_PULL_FIELDS.join(','),
        ]),
      ),
    pullFiles: async (repo) =>
      pullFilesOf(
        await ghJson<ListedFiles[]>([
          'pr',
          'list',
          '--repo',
          repo,
          '--state',
          'open',
          '--limit',
          PULL_LIMIT,
          '--json',
          'number,files',
        ]),
      ),
    pullState: async (repo, pull) =>
      (
        await ghJson<{ state: string }>([
          'pr',
          'view',
          String(pull),
          '--repo',
          repo,
          '--json',
          'state',
        ])
      ).state,
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
