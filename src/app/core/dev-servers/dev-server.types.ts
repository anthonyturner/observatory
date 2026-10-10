/** Where one project's dev server stands, as the local API reports it. */
export type DevServerStatus =
  /** Not asked yet: what a project's server reads as until the API first answers. Never sent by the API. */
  | { readonly state: 'checking' }
  /** This machine cannot run the project at all, because it has no checkout of it; `reason` says so. */
  | { readonly state: 'unavailable'; readonly reason: string }
  | { readonly state: 'stopped' }
  | { readonly state: 'starting' }
  | { readonly state: 'running'; readonly url: string }
  | { readonly state: 'failed'; readonly reason: string };

export const CHECKING: DevServerStatus = { state: 'checking' };
export const STOPPED: DevServerStatus = { state: 'stopped' };
export const STARTING: DevServerStatus = { state: 'starting' };
