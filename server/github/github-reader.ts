/** A repository the account owns. */
export interface RepoRef {
  readonly name: string;
  readonly nameWithOwner: string;
  /** Unknown counts as private wherever a visitor might see it. */
  readonly isPrivate: boolean;
}

export const REPO_FIELDS: readonly string[] = ['name', 'nameWithOwner', 'isPrivate'];

/** One check or status on a pull request's head commit. */
export interface CheckRun {
  readonly conclusion?: string | null;
  readonly state?: string | null;
}

/** An open pull request, with only the fields the counts read. */
export interface PullRequest {
  readonly number: number;
  readonly title: string;
  readonly url: string;
  /** `MERGEABLE`, `CONFLICTING` or `UNKNOWN`: GitHub works it out lazily. */
  readonly mergeable: string;
  readonly statusCheckRollup: readonly CheckRun[] | null;
  readonly closingIssuesReferences: readonly { readonly number: number }[] | null;
  readonly updatedAt: string;
}

/** The `gh --json` fields PullRequest holds. */
export const PULL_REQUEST_FIELDS: readonly string[] = [
  'number',
  'title',
  'url',
  'mergeable',
  'statusCheckRollup',
  'closingIssuesReferences',
  'updatedAt',
];

/** Everything the projects report needs from GitHub, and nothing else. */
export interface GitHubReader {
  /** The signed-in account's login. */
  viewer(): Promise<string>;
  /** Source repositories the owner has: no forks, no archives. */
  ownedRepos(owner: string): Promise<RepoRef[]>;
  openPulls(repo: string): Promise<PullRequest[]>;
  /** Asks for one pull request's mergeability, which also nudges GitHub to work it out. */
  mergeableOf(repo: string, pull: number): Promise<string>;
  /** Open issue numbers, or null when the repository has issues switched off. */
  openIssueNumbers(repo: string): Promise<number[] | null>;
}
