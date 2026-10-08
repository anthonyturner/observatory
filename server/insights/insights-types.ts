import type { CommitWeek, TrafficSeries } from '../github/insights-reader.ts';
import type { FinishedPull } from '../history/ledger.ts';

/**
 * How reading one part went: `read`, or why it is empty: GitHub is still
 * `counting` it, the token has `no-access`, GitHub `failed` to answer, or it
 * is `withheld` from a preview visitor.
 */
export type PartStatus = 'read' | 'counting' | 'no-access' | 'failed' | 'withheld';

export interface PartState {
  readonly status: PartStatus;
  /** One plain line on why nothing was read; null when it was. */
  readonly note: string | null;
}

/** One author's commits over the screen's weeks. */
export interface Contributor {
  readonly login: string;
  readonly isBot: boolean;
  readonly commits: number;
  readonly additions: number;
  readonly deletions: number;
}

export interface CommitsPart extends PartState {
  /** Oldest first. */
  readonly weeks: readonly CommitWeek[];
}

export interface ContributorsPart extends PartState {
  /** Most commits first. */
  readonly people: readonly Contributor[];
}

export interface PullsPart extends PartState {
  /** The pull requests merged or closed in the screen's weeks, oldest first. */
  readonly finished: readonly FinishedPull[];
}

export interface TrafficPart extends PartState {
  readonly views: TrafficSeries | null;
  readonly clones: TrafficSeries | null;
}

/** What `GET /api/insights` returns. */
export interface InsightsReport {
  readonly generatedAt: string;
  readonly repo: string;
  /** How many weeks back the commits, contributors and pull requests reach. */
  readonly weeks: number;
  readonly commits: CommitsPart;
  readonly contributors: ContributorsPart;
  readonly pulls: PullsPart;
  /** GitHub keeps only the last fourteen days. */
  readonly traffic: TrafficPart;
}
