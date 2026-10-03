import type { PullBucket } from './pull-counts.ts';

/** How many of a project's pull requests and issues are in each state. */
export interface ProjectCounts {
  readonly conflicted: number;
  readonly failing: number;
  /** GitHub has not worked out whether these merge. Never healthy. */
  readonly unknown: number;
  readonly unlinked: number;
  readonly unreviewed: number;
  /** Open issues no open pull request closes. */
  readonly unclaimed: number;
}

/** One project as `GET /api/projects` reports it. */
export interface ProjectSnapshot {
  readonly name: string;
  readonly repo: string;
  readonly dashboardUrl: string;
  readonly open: number;
  readonly counts: ProjectCounts;
  /** Open issues; left out when issues are switched off. */
  readonly issues?: number;
  readonly oldestIdleDays?: number;
  /** Why GitHub could not be read for it; its counts are then unknown. */
  readonly error?: string;
  /** Open pull requests, at most the 100 the readers ask GitHub for, so a busier
   *  repository's list is incomplete. Null when GitHub could not be read for it. */
  readonly openPulls: readonly OpenPull[] | null;
  /** Open issue numbers, at most the 1,000 the readers ask GitHub for. Null when
   *  issues are switched off or GitHub could not be read. */
  readonly openIssues: readonly number[] | null;
}

/** One open pull request, by number, with the most urgent thing about it. */
export interface OpenPull {
  readonly number: number;
  readonly bucket: PullBucket;
}

/** One pull request from the top of the blocked-first queue across every project. */
export interface Directive {
  readonly project: string;
  readonly number: number;
  readonly title: string;
  readonly url: string;
  readonly bucket: PullBucket;
  readonly updatedAt: string;
}

export interface ProjectsReport {
  readonly generatedAt: string;
  readonly projects: readonly ProjectSnapshot[];
  /** The most urgent open pull requests, most urgent first. */
  readonly directives: readonly Directive[];
}
