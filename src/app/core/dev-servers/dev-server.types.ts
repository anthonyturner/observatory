/** What a dev server runs: a project's checkout, or one pull request of it in a worktree. */
export interface DevTarget {
  /** `owner/name`. */
  readonly repo: string;
  /** The pull request whose head is run; absent for the project's checkout. */
  readonly pull?: number;
}

/** How far a starting server has got: a pull request is fetched and installed before its server starts. */
export type StartPhase = 'fetching' | 'installing' | 'starting';

/** Where one target's dev server stands, as the local API reports it. */
export type DevServerStatus =
  /** Not asked yet: what a project's server reads as until the API first answers. Never sent by the API. */
  | { readonly state: 'checking' }
  /** This machine cannot run the project at all, because it has no checkout of it; `reason` says so. */
  | { readonly state: 'unavailable'; readonly reason: string }
  | { readonly state: 'stopped' }
  | { readonly state: 'starting'; readonly phase: StartPhase }
  | { readonly state: 'running'; readonly url: string }
  | { readonly state: 'failed'; readonly reason: string };

export const CHECKING: DevServerStatus = { state: 'checking' };
export const STOPPED: DevServerStatus = { state: 'stopped' };
export const STARTING: DevServerStatus = { state: 'starting', phase: 'starting' };
/** A pull request's server as it begins, before the API has said otherwise. */
export const FETCHING: DevServerStatus = { state: 'starting', phase: 'fetching' };
