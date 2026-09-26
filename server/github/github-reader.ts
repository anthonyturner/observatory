/** A repository the account owns. */
export interface RepoRef {
  readonly name: string;
  readonly nameWithOwner: string;
}

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
