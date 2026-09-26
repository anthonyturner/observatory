/** What the star map's memory needs from GitHub: how a pull request that left the queue left it. */
export interface FateReader {
  /** `OPEN`, `MERGED` or `CLOSED`. */
  pullState(repo: string, pull: number): Promise<string>;
}
