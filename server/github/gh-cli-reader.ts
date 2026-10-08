import { comparePath, comparisonFrom } from './compare-reader.ts';
import {
  readDefaultBranch,
  readRunJobs,
  readWorkflowRuns,
  readWorkflows,
} from './actions-reader.ts';
import { gh, ghJson } from './gh-cli.ts';
import { DIFF_MEDIA_TYPE } from './github-rest.ts';
import { readChangelog } from './changelog-reader.ts';
import { readCheckHistory } from './check-history.ts';
import { ghCliRerunner, ghCliWriter } from './gh-cli-writer.ts';
import { PULL_STATE_FIELDS, type PullState } from './fate-reader.ts';
import { type ListedFiles, pullFilesOf } from './listed-files.ts';
import { readMergedPulls } from './merged-pull-reader.ts';
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
  RAW_ISSUE_DETAIL_FIELDS,
  RAW_ISSUE_FIELDS,
  type RawIssue,
  type RawIssueDetail,
} from './issue-reader.ts';
import { PULL_DETAIL_FIELDS, type RawLabel, type RawPull } from './pull-reader.ts';
import { QUEUE_PULL_FIELDS, type QueuePull } from './queue-reader.ts';
import { readReleases, readTags } from './release-reader.ts';
import { readFilePaths, readFileText } from './docs-reader.ts';
import { rawWikiReader } from './wiki-reader.ts';
import { securityReader } from './security-reader.ts';
import type { JsonGet } from './rest-json.ts';
import { AGENT_PULL_FIELDS, type AgentPull } from '../agents/agents-report.ts';
import { LEDGER_PULL_FIELDS, type LedgerPull, byNumberDescending } from '../history/ledger.ts';

const PULL_LIMIT = '100';
const ISSUE_LIMIT = '1000';
/** Enough for sixty days of a busy repository's pull requests. */
const LEDGER_LIMIT = '400';
/** Enough of a repository's pull requests for the agents' report cards. */
const AGENT_LIMIT = '500';
const REPO_LIMIT = '1000';
const LABEL_LIMIT = '200';

/** A repository with issues switched off answers `gh issue list` with this. */
const ISSUES_DISABLED = /has disabled issues/i;

/** One REST path through `gh api`, as JSON. */
const getJson: JsonGet = (path) => ghJson<unknown>(['api', path]);

/** GitHub through the `gh` CLI, as the account this machine signed it in with. */
export function ghCliReader(): GitHub {
  return {
    ...ghCliWriter(),
    ...ghCliRerunner(),
    checkHistory: (repo) => readCheckHistory(getJson, repo),
    releases: (repo, limit) => readReleases(getJson, repo, limit),
    tags: (repo, limit) => readTags(getJson, repo, limit),
    changelog: (repo) => readChangelog(getJson, repo),
    mergedPulls: (repo) => readMergedPulls(getJson, repo),
    workflowRuns: (repo, branch) => readWorkflowRuns(getJson, repo, branch),
    workflows: (repo) => readWorkflows(getJson, repo),
    runJobs: (repo, runId) => readRunJobs(getJson, repo, runId),
    defaultBranch: (repo) => readDefaultBranch(getJson, repo),
    filePaths: (repo, ref) => readFilePaths(getJson, repo, ref),
    fileText: (repo, path, ref) => readFileText(getJson, repo, path, ref),
    ...rawWikiReader(),
    ...securityReader(getJson),
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
    issueDetail: (repo, number) =>
      ghJson<RawIssueDetail>([
        'issue',
        'view',
        String(number),
        '--repo',
        repo,
        '--json',
        RAW_ISSUE_DETAIL_FIELDS.join(','),
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
    pullDiff: (repo, number) => gh(['pr', 'diff', String(number), '--repo', repo]),
    commitDiff: (repo, sha) =>
      gh(['api', `repos/${repo}/commits/${sha}`, '-H', `Accept: ${DIFF_MEDIA_TYPE}`]),
    compare: async (repo, base, head) =>
      comparisonFrom(await ghJson<unknown>(['api', `${comparePath(repo, base, head)}?per_page=1`])),
    compareDiff: (repo, base, head) =>
      gh(['api', comparePath(repo, base, head), '-H', `Accept: ${DIFF_MEDIA_TYPE}`]),
    repoLabels: (repo) =>
      ghJson<RawLabel[]>([
        'label',
        'list',
        '--repo',
        repo,
        '--limit',
        LABEL_LIMIT,
        '--json',
        'name,color',
      ]),
    agentPulls: (repo) =>
      ghJson<AgentPull[]>([
        'pr',
        'list',
        '--repo',
        repo,
        '--state',
        'all',
        '--limit',
        AGENT_LIMIT,
        '--json',
        AGENT_PULL_FIELDS.join(','),
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
    pullState: (repo, pull) =>
      ghJson<PullState>([
        'pr',
        'view',
        String(pull),
        '--repo',
        repo,
        '--json',
        PULL_STATE_FIELDS.join(','),
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
