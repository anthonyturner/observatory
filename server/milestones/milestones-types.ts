import type { DiscussionMark } from '../github/discussion-reader.ts';
import type { MilestoneItemMark } from '../github/milestone-reader.ts';

/** One milestone, with its issues and pull requests counted together, as GitHub's progress counts them. */
export interface MilestoneView {
  readonly number: number;
  readonly title: string;
  readonly description: string | null;
  readonly url: string;
  readonly isOpen: boolean;
  readonly dueOn: string | null;
  readonly closedAt: string | null;
  readonly open: number;
  /** Closed issues, and merged or closed pull requests. */
  readonly closed: number;
  /** The open ones first, then the done; past a limit only the most recently updated. */
  readonly items: readonly MilestoneItemMark[];
}

export interface MilestonesPart {
  /** One plain line on why GitHub gave none; null when it answered. */
  readonly note: string | null;
  /** Soonest due first; those with no due date last. */
  readonly open: readonly MilestoneView[];
  /** Most lately closed first. */
  readonly closed: readonly MilestoneView[];
}

export interface DiscussionsPart {
  /** One plain line on why GitHub gave none; null when it answered. */
  readonly note: string | null;
  readonly isEnabled: boolean;
  /** Every discussion the repository has, past the ones listed. */
  readonly total: number;
  /** Most recently active first. */
  readonly threads: readonly DiscussionMark[];
}

/** What `GET /api/milestones` returns: a project's milestones, and its discussions beside them. */
export interface MilestonesReport {
  readonly generatedAt: string;
  readonly repo: string;
  readonly milestones: MilestonesPart;
  readonly discussions: DiscussionsPart;
}
