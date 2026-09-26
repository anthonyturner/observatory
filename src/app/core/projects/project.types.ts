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
}
