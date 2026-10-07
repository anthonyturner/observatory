import { LiveAgentsGap } from './live-agents.types';

/** Why an agent's changes could not be read, as the local API says. */
export type ChangesProblem =
  'no-folder' | 'folder-gone' | 'not-a-repo' | 'no-base' | 'git-failed' | 'timed-out';

/** The code an agent has changed in its folder, as `GET /api/live-agents/changes` reads it from git. */
export interface AgentChanges {
  /** The folder the agent's transcript names. */
  readonly folder: string;
  /** Where git was read: the folder's top level, or the checkout a gone folder's branch survives in. */
  readonly readFrom: string;
  readonly branch: string | null;
  /** The remote branch compared with, as of the last fetch: `origin/main`. */
  readonly base: string;
  readonly repo: string | null;
  readonly isCommittedOnly: boolean;
  readonly isSharedCheckout: boolean;
  readonly diff: string;
  readonly diffBytes: number;
  readonly diffTruncated: boolean;
  readonly skippedLarge: readonly string[];
  readonly untrackedOverCap: number;
}

export type AgentChangesState =
  | LiveAgentsGap
  | { readonly status: 'problem'; readonly problem: ChangesProblem }
  | { readonly status: 'ready'; readonly changes: AgentChanges };
