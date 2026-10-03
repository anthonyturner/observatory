/** What happened in a tracked project that is worth a notice. */
export type ActivityKind = 'merged' | 'issue';

/** Every kind, in the order their news is told: merged pull requests first. */
export const ACTIVITY_KINDS: readonly ActivityKind[] = ['merged', 'issue'];

/** A pull request or issue one report shows has come or gone, before its
 *  title is read. */
export interface Sighting {
  readonly repo: string;
  /** The project's display name, or `owner/repo` where two projects share one. */
  readonly label: string;
  readonly number: number;
}

/** One merged pull request or new issue, ready to announce. */
export interface ActivityItem extends Sighting {
  readonly kind: ActivityKind;
  readonly title: string;
}
