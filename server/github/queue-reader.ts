import { PULL_REQUEST_FIELDS, type PullRequest } from './github-reader.ts';

/** An open pull request with what the review queue shows about it. */
export interface QueuePull extends PullRequest {
  readonly isDraft: boolean;
  readonly additions: number | null;
  readonly deletions: number | null;
  readonly createdAt: string;
}

/** The `gh --json` fields QueuePull holds. */
export const QUEUE_PULL_FIELDS: readonly string[] = [
  ...PULL_REQUEST_FIELDS,
  'isDraft',
  'additions',
  'deletions',
  'createdAt',
];

/** What the review queue needs from GitHub, and nothing else. */
export interface QueueReader {
  queuePulls(repo: string): Promise<QueuePull[]>;
  /** Asks for one pull request's mergeability, which also nudges GitHub to work it out. */
  mergeableOf(repo: string, pull: number): Promise<string>;
}
