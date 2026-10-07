/** Why an agent's changes could not be read, each with its own message on the page. */
export type ChangesProblem =
  'no-folder' | 'folder-gone' | 'not-a-repo' | 'no-base' | 'git-failed' | 'timed-out';

/** The code an agent has changed in its folder, against where its branch left the base. */
export interface ChangesDiff {
  readonly kind: 'diff';
  /** The folder the agent's transcript names. */
  readonly folder: string;
  /** Where git was read: that folder's top level, or, once it is gone, the checkout its branch survives in. */
  readonly readFrom: string;
  /** Null when the folder's HEAD is detached. */
  readonly branch: string | null;
  /** The remote branch compared with, as of the last fetch: `origin/main`. */
  readonly base: string;
  readonly repo: string | null;
  /** The folder is gone, so only its branch's commits are shown. */
  readonly isCommittedOnly: boolean;
  /** The primary checkout, on the default branch: other sessions may share it. */
  readonly isSharedCheckout: boolean;
  readonly diff: string;
  /** How long the diff was before it was cut to fit. */
  readonly diffBytes: number;
  readonly diffTruncated: boolean;
  /** Untracked files left out for their size. */
  readonly skippedLarge: readonly string[];
  /** Untracked files left out past the cap on how many are read. */
  readonly untrackedOverCap: number;
}

export interface ChangesGap {
  readonly kind: 'problem';
  readonly problem: ChangesProblem;
  readonly folder: string | null;
}

export type AgentChanges = ChangesDiff | ChangesGap;

/** What `GET /api/live-agents/changes` returns. */
export interface AgentChangesAnswer {
  readonly generatedAt: string;
  readonly changes: AgentChanges;
}
