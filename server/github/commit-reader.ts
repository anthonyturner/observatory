/** One commit's changes, for the PR screen's Commits tab. */
export interface CommitReader {
  /** The commit's unified diff. GitHub refuses one that is too large, and this throws. */
  commitDiff(repo: string, sha: string): Promise<string>;
}
