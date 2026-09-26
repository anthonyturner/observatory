/** How a pull request is merged. */
export type MergeMethod = 'squash' | 'merge' | 'rebase';

export const MERGE_METHODS: readonly MergeMethod[] = ['squash', 'merge', 'rebase'];

/** The reversible changes: what `gh pr edit` takes. */
export interface PullChanges {
  readonly title?: string;
  readonly body?: string;
  readonly addLabels?: readonly string[];
  readonly removeLabels?: readonly string[];
  /** GitHub logins; `@me` is the signed-in account. */
  readonly addAssignees?: readonly string[];
  readonly removeAssignees?: readonly string[];
  readonly addReviewers?: readonly string[];
  readonly removeReviewers?: readonly string[];
}

/** A merge, refused by GitHub if the branch has moved past `headOid`. */
export interface MergeRequest {
  readonly method: MergeMethod;
  readonly headOid: string;
}

/** A pull request as it stands on GitHub now, just before it is changed. */
export interface LivePull {
  /** `OPEN`, `CLOSED` or `MERGED`. */
  readonly state: string;
  readonly isDraft: boolean;
  readonly headRefOid: string;
  readonly mergeable: string;
}

/** What the PR screen's Edit tab changes on GitHub. */
export interface PullWriter {
  livePull(repo: string, number: number): Promise<LivePull>;
  editPull(repo: string, number: number, changes: PullChanges): Promise<void>;
  /** Takes a draft out of draft. */
  markReady(repo: string, number: number): Promise<void>;
  /** Never overrides branch protection and never deletes the branch. */
  mergePull(repo: string, number: number, merge: MergeRequest): Promise<void>;
}
