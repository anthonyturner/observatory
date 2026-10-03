/** What happened in a tracked project that is worth a notice, in the order its
 *  news is told: finished work first, then started. `issue` is a new issue. */
export const ACTIVITY_KINDS = ['merged', 'issue-closed', 'pull-opened', 'issue'] as const;

export type ActivityKind = (typeof ACTIVITY_KINDS)[number];

/** A pull request or issue one report shows has come or gone, before its
 *  title is read. */
export interface Sighting {
  readonly repo: string;
  /** The project's display name, or `owner/repo` where two projects share one. */
  readonly label: string;
  readonly number: number;
}

/** An issue a merged pull request closed, told with it rather than on its own. */
export interface ClosedIssue {
  readonly number: number;
  readonly title: string;
}

/** One event, ready to announce. */
export interface ActivityItem extends Sighting {
  readonly kind: ActivityKind;
  readonly title: string;
  /** Only on a merged pull request: the issues it closed in the same check. */
  readonly closing?: readonly ClosedIssue[];
}
