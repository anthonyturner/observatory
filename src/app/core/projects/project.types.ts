/** How many of a project's pull requests and issues are in each state. */
export interface ProjectCounts {
  readonly conflicted: number;
  readonly failing: number;
  /** GitHub has not yet worked out whether these merge. Never healthy. */
  readonly unknown: number;
  readonly unlinked: number;
  readonly unreviewed: number;
  readonly unclaimed: number;
}

/** One open pull request as the projects report lists it. */
export interface ListedPull {
  readonly number: number;
  /** Null when the report did not say. */
  readonly title: string | null;
  /** The issue numbers it says it closes. */
  readonly closes: readonly number[];
}

/** One tracked project as last read from GitHub. */
export interface ProjectSnapshot {
  readonly name: string;
  readonly repo: string;
  readonly dashboardUrl: string;
  readonly open: number;
  readonly counts: ProjectCounts;
  readonly issues?: number;
  readonly oldestIdleDays?: number;
  /** Set when GitHub could not be read for this project; its counts are then unknown. */
  readonly error?: string;
  /** Its open pull requests, up to the 100 the API asks GitHub for. Absent when
   *  unknown: unreadable, or an API too old to send them. */
  readonly openPulls?: readonly ListedPull[];
  /** Its open issue numbers. Absent when unknown, which includes issues switched off. */
  readonly openIssues?: readonly number[];
}
