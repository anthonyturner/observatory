/** Where one pull request stands now, and what it is called. */
export interface PullState {
  /** `OPEN`, `MERGED` or `CLOSED`. */
  readonly state: string;
  readonly title: string;
}

/** The `gh --json` fields PullState holds. */
export const PULL_STATE_FIELDS: readonly string[] = ['state', 'title'];

/** Where a pull request stands: how one that left the queue left it, for the
 *  star map's memory, and `GET /api/pull-state`. */
export interface FateReader {
  pullState(repo: string, pull: number): Promise<PullState>;
}
