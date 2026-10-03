/** Where one pull request stands now, and what it is called. */
export interface PullState {
  readonly state: 'OPEN' | 'MERGED' | 'CLOSED';
  readonly title: string;
}

/** The `gh --json` fields PullState holds. */
export const PULL_STATE_FIELDS: readonly string[] = ['state', 'title'];

/** Whether a pull request is open, merged or closed. */
export interface FateReader {
  pullState(repo: string, pull: number): Promise<PullState>;
}
