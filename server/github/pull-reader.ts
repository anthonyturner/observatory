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
  readonly labels: readonly { readonly name: string }[];
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
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** Everything the PR screen needs from GitHub. */
export interface PullReader {
  pullDetail(repo: string, number: number): Promise<RawPull>;
}

export const PULL_DETAIL_FIELDS = [
  'number',
  'title',
  'body',
  'url',
  'isDraft',
  'mergeable',
  'author',
  'headRefName',
  'baseRefName',
  'labels',
  'reviewDecision',
  'reviewRequests',
  'latestReviews',
  'statusCheckRollup',
  'closingIssuesReferences',
  'additions',
  'deletions',
  'changedFiles',
  'createdAt',
  'updatedAt',
].join(',');
