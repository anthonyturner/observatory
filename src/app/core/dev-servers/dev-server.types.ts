/** Where one project's dev server stands, as the local API reports it. */
export type DevServerStatus =
  | { readonly state: 'stopped' }
  | { readonly state: 'starting' }
  | { readonly state: 'running'; readonly url: string }
  | { readonly state: 'failed'; readonly reason: string };

export const STOPPED: DevServerStatus = { state: 'stopped' };
export const STARTING: DevServerStatus = { state: 'starting' };
