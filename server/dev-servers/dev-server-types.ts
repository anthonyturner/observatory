/**
 * What a dev server runs: a project's own checkout, or one pull request of it
 * in a worktree of that checkout. Each target has at most one server.
 */
export interface DevTarget {
  /** `owner/name`. */
  readonly repo: string;
  /** The pull request whose head is run; absent for the project's checkout. */
  readonly pull?: number;
}

/** Where a server stands before it answers: a pull request is fetched and its dependencies installed first. */
export type StartPhase = 'fetching' | 'installing' | 'starting';

type ServerState =
  /** `reason` says why this machine cannot run the project at all: it has no checkout of it. */
  | { readonly state: 'unavailable'; readonly reason: string }
  | { readonly state: 'stopped' }
  | { readonly state: 'starting'; readonly phase: StartPhase }
  /** `url` is where to open it. */
  | { readonly state: 'running'; readonly url: string }
  /** `reason` says why it could not start or why it ended, in words for the owner. */
  | { readonly state: 'failed'; readonly reason: string };

/** Where one target's dev server stands. A server that never started and one that was stopped read alike. */
export type DevServerStatus = DevTarget & ServerState;

/** Starts, reports and stops the dev server of a target. */
export interface DevServerControl {
  /** Starts the target's dev server, or returns the one already running. Never throws for a target that cannot start: that is an `unavailable` or `failed` status. A pull request's is prepared in the background, so this answers `starting` while it is fetched and installed. */
  start(target: DevTarget): Promise<DevServerStatus>;
  status(target: DevTarget): Promise<DevServerStatus>;
  /** Ends the server and everything it started, and removes a pull request's worktree. Stopping one that is not running succeeds. */
  stop(target: DevTarget): Promise<DevServerStatus>;
}
