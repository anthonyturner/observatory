import type { DevTarget, StartPhase } from './dev-server-types.ts';
import type { PullWorktrees } from './pull-worktrees.ts';

/** A folder to run a server in, or why there is not one. */
export type Prepared = { readonly folder: string } | { readonly why: string };

/** What a workspace is given to prepare itself. */
export interface PrepareRequest {
  /** Aborts the preparation, and any command it has running. */
  readonly signal: AbortSignal;
  readonly onPhase: (phase: StartPhase) => void;
  /** Whether a server (or a failed one still listed) holds `target`, so its files must stay. */
  readonly isBusy: (target: DevTarget) => boolean;
}

/**
 * Where one target's dev server runs, and what it takes to get it there. The
 * dev-server manager asks for a folder and gives it back; it knows nothing of
 * how either is done.
 */
export interface Workspace {
  /** What a start reads as until preparing says otherwise. */
  readonly firstPhase: StartPhase;
  /** Whether it is ready in a moment, so a start can wait for it and answer with how it went. */
  readonly isQuick: boolean;
  /** Whether releasing removes files, after the server that held them is gone. */
  readonly leavesFiles: boolean;
  /** The folder to run in. `clone` is the project's checkout, from the registry. */
  prepare(clone: string, request: PrepareRequest): Promise<Prepared>;
  /** Removes what `prepare` made, or says why it cannot. Nothing to remove succeeds. */
  release(clone: string): Promise<string | null>;
}

/** The workspaces of a machine's dev-server targets. */
export interface Workspaces {
  of(target: DevTarget): Workspace;
  /** Ends any command a workspace has running, at once: for the API's exit. */
  shutdown(): void;
}

/** What a pull request's workspace needs of its worktrees. */
type Worktrees = Pick<PullWorktrees, 'prepare' | 'remove' | 'shutdown'>;

/** The project's own checkout: run in place, and nothing to give back. */
const CHECKOUT: Workspace = {
  firstPhase: 'starting',
  isQuick: true,
  leavesFiles: false,
  prepare: async (clone) => ({ folder: clone }),
  release: async () => null,
};

/** One pull request's head in a worktree of the checkout. */
function pullWorkspace(worktrees: Worktrees, repo: string, pull: number): Workspace {
  return {
    firstPhase: 'fetching',
    isQuick: false,
    leavesFiles: true,
    prepare: (clone, { signal, onPhase, isBusy }) =>
      worktrees.prepare({
        repo,
        clone,
        pull,
        signal,
        onPhase,
        isInUse: (other) => isBusy({ repo, pull: other }),
      }),
    release: (clone) => worktrees.remove(clone, pull),
  };
}

/** The checkout for a project's own target, a worktree for a pull request's. */
export function localWorkspaces(worktrees: Worktrees): Workspaces {
  return {
    of: ({ repo, pull }) => (pull === undefined ? CHECKOUT : pullWorkspace(worktrees, repo, pull)),
    shutdown: () => worktrees.shutdown(),
  };
}
