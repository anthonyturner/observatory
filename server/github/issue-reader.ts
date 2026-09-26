/** A link GitHub keeps between an issue and a pull request, as `gh --json` gives it. */
export interface LinkRef {
  readonly number: number;
  readonly url: string;
}

/** One issue as `gh issue list --json` reports it. */
export interface RawIssue {
  readonly number: number;
  readonly title: string;
  readonly url: string;
  readonly labels: readonly { readonly name: string; readonly color: string }[];
  readonly assignees: readonly { readonly login: string }[];
  /** Null for a deleted account. */
  readonly author: { readonly login: string } | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  /** Null while it is open. */
  readonly closedAt: string | null;
  /** `COMPLETED`, `NOT_PLANNED`, `DUPLICATE`, or empty while it is open. */
  readonly stateReason: string;
  /** The pull requests the issue records as closing it, or as having closed it. */
  readonly closedByPullRequestsReferences: readonly LinkRef[] | null;
}

/** The `gh --json` fields RawIssue holds. */
export const RAW_ISSUE_FIELDS: readonly string[] = [
  'number',
  'title',
  'url',
  'labels',
  'assignees',
  'author',
  'createdAt',
  'updatedAt',
  'closedAt',
  'stateReason',
  'closedByPullRequestsReferences',
];

/** An open pull request, with the issues it says it closes. */
export interface ClosingPull {
  readonly number: number;
  readonly closingIssuesReferences: readonly LinkRef[] | null;
}

/** The `gh --json` fields ClosingPull holds. */
export const CLOSING_PULL_FIELDS: readonly string[] = ['number', 'closingIssuesReferences'];

/** What the Issues screen needs from GitHub. */
export interface IssueReader {
  openIssues(repo: string): Promise<RawIssue[]>;
  /** Issues closed on or after `sinceDay` (YYYY-MM-DD). */
  closedIssues(repo: string, sinceDay: string): Promise<RawIssue[]>;
  closingPulls(repo: string): Promise<ClosingPull[]>;
}
