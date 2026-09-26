import type { RouteTable } from './api-handler.ts';

/**
 * Who is asking. `local` is this machine, where there is no sign-in; hosted,
 * `owner` is an allowed login, `visitor` someone looking at the public
 * preview, and `signed-out` anyone else, who must sign in first.
 */
export type Access = 'local' | 'owner' | 'visitor' | 'signed-out';

/** What `GET /api/session` returns: the page shows a banner, hides writes or signs in from it. */
export interface SessionReport {
  readonly access: Access;
  /** Where to sign in, with `?next=` added by the page; null where there is no sign-in. */
  readonly signIn: string | null;
}

export const SESSION_PATH = '/api/session';

const LOCAL_SESSION: SessionReport = { access: 'local', signIn: null };

/** `table` with the session route this machine answers: always the owner, never a sign-in. */
export function withLocalSession(table: RouteTable): RouteTable {
  return { ...table, get: { ...table.get, [SESSION_PATH]: async () => LOCAL_SESSION } };
}
