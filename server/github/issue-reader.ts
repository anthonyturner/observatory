/** One open issue as `gh issue list --json` reports it. */
export interface RawIssue {
  readonly number: number;
  readonly title: string;
  readonly url: string;
  readonly labels: readonly { readonly name: string }[];
  readonly assignees: readonly { readonly login: string }[];
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** The `gh --json` fields RawIssue holds. */
export const RAW_ISSUE_FIELDS: readonly string[] = [
  'number',
  'title',
  'url',
  'labels',
  'assignees',
  'createdAt',
  'updatedAt',
];

/** An open pull request, with the issues it says it closes. */
export interface ClosingPull {
  readonly number: number;
  readonly closingIssuesReferences: readonly { readonly number: number }[] | null;
}

/** What the Issues tab needs from GitHub. */
export interface IssueReader {
  openIssues(repo: string): Promise<RawIssue[]>;
  closingPulls(repo: string): Promise<ClosingPull[]>;
  /** Issues closed on or after `sinceDay` (YYYY-MM-DD). */
  closedSinceCount(repo: string, sinceDay: string): Promise<number>;
}
