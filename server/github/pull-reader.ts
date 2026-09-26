/** One check as `gh pr view` reports it: a check run or a commit status. */
export interface RawCheck {
  readonly __typename?: string;
  /** A check run's name, or a status's context. */
  readonly name?: string;
  readonly context?: string;
  readonly workflowName?: string;
  /** Check runs: `COMPLETED`, `IN_PROGRESS`, `QUEUED`... */
  readonly status?: string;
  /** Check runs: `SUCCESS`, `FAILURE`, `NEUTRAL`, `SKIPPED`... */
  readonly conclusion?: string | null;
  /** Statuses: `SUCCESS`, `FAILURE`, `ERROR`, `PENDING`. */
  readonly state?: string;
  readonly detailsUrl?: string;
  readonly targetUrl?: string;
}

/** One pull request as `gh pr view --json` reports it, with the fields the PR screen reads. */
export interface RawPull {
  readonly number: number;
  readonly title: string;
  readonly body: string;
  readonly url: string;
  readonly isDraft: boolean;
  readonly mergeable: string;
  readonly author: { readonly login: string } | null;
  readonly headRefName: string;
  readonly baseRefName: string;
  /** The commit the pull request's branch points at: what a merge is pinned to. */
  readonly headRefOid: string;
  readonly labels: readonly RawLabel[];
  readonly assignees: readonly { readonly login: string }[];
  readonly reviewDecision: string;
  readonly reviewRequests: readonly { readonly login?: string; readonly name?: string }[];
  readonly latestReviews: readonly {
    readonly author: { readonly login: string } | null;
    readonly state: string;
  }[];
  readonly statusCheckRollup: readonly RawCheck[] | null;
  readonly closingIssuesReferences: readonly { readonly number: number }[] | null;
  readonly additions: number;
  readonly deletions: number;
  readonly changedFiles: number;
  readonly files: readonly RawFile[] | null;
  readonly commits: readonly RawCommit[] | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** A label as GitHub gives it: its colour is six hex digits, no `#`. */
export interface RawLabel {
  readonly name: string;
  readonly color: string;
}

/** One changed file; `changeType` is `ADDED`, `MODIFIED`, `DELETED`, `RENAMED`... */
export interface RawFile {
  readonly path: string;
  readonly additions: number;
  readonly deletions: number;
  readonly changeType: string;
}

export interface RawCommit {
  readonly oid: string;
  readonly messageHeadline: string;
  readonly committedDate: string | null;
  readonly authoredDate: string;
  readonly authors: readonly { readonly login: string; readonly name: string }[];
}

/** Everything the PR screen needs from GitHub. */
export interface PullReader {
  pullDetail(repo: string, number: number): Promise<RawPull>;
  /** The unified diff. GitHub refuses one that is too large, and this throws. */
  pullDiff(repo: string, number: number): Promise<string>;
  /** The labels a repository has, so an edit can only pick one that exists. */
  repoLabels(repo: string): Promise<RawLabel[]>;
}

/** The `gh --json` fields RawPull holds. */
export const PULL_DETAIL_FIELDS: readonly string[] = [
  'number',
  'title',
  'body',
  'url',
  'isDraft',
  'mergeable',
  'author',
  'headRefName',
  'baseRefName',
  'headRefOid',
  'labels',
  'assignees',
  'reviewDecision',
  'reviewRequests',
  'latestReviews',
  'statusCheckRollup',
  'closingIssuesReferences',
  'additions',
  'deletions',
  'changedFiles',
  'files',
  'commits',
  'createdAt',
  'updatedAt',
];
