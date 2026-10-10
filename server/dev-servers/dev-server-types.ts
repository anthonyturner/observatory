/** Where one project's dev server stands. A server that never started and one that was stopped read alike. */
export type DevServerStatus =
  /** `reason` says why this machine cannot run the project at all: it has no checkout of it. */
  | { readonly repo: string; readonly state: 'unavailable'; readonly reason: string }
  | { readonly repo: string; readonly state: 'stopped' }
  | { readonly repo: string; readonly state: 'starting' }
  /** `url` is where to open it. */
  | { readonly repo: string; readonly state: 'running'; readonly url: string }
  /** `reason` says why it could not start or why it ended, in words for the owner. */
  | { readonly repo: string; readonly state: 'failed'; readonly reason: string };

/** Starts, reports and stops the dev server of a project, by `owner/name`. */
export interface DevServerControl {
  /** Starts the project's dev server, or returns the one already running. Never throws for a project that cannot start: that is an `unavailable` or `failed` status. */
  start(repo: string): Promise<DevServerStatus>;
  status(repo: string): Promise<DevServerStatus>;
  /** Ends the server and everything it started. Stopping one that is not running succeeds. */
  stop(repo: string): DevServerStatus;
}
