import { type ApiHandler, json } from '../http/api-handler.ts';
import { type Access, SESSION_PATH, type SessionReport } from '../http/session.ts';

/** A route answered before anyone is asked who they are: signing in, and the machines' own. */
export type OpenRoute = (request: Request, url: URL) => Promise<Response>;

/** Open routes by `METHOD /path`. */
export type OpenRoutes = Readonly<Record<string, OpenRoute>>;

export interface Gate {
  readonly open: OpenRoutes;
  /** Who is asking, from the request's session. */
  access(request: Request): Exclude<Access, 'local'>;
  /** Where to sign in. */
  readonly signIn: string;
  readonly owner: ApiHandler;
  /** The read-only preview, or null when the site has none. */
  readonly visitor: ApiHandler | null;
}

const HTTP_OK = 200;
const HTTP_UNAUTHORIZED = 401;
const HTTP_SERVER_ERROR = 500;

async function openRoute(route: OpenRoute, request: Request, url: URL): Promise<Response> {
  try {
    return await route(request, url);
  } catch (error) {
    console.error(error);
    return json(HTTP_SERVER_ERROR, { error: 'server error' });
  }
}

/**
 * The hosted API: open routes first, then everything else by who is asking.
 * The owner gets the whole API, a visitor the preview's, and anyone else is
 * told to sign in. The session route says which, so the page can follow.
 */
export function gatedHandler(gate: Gate): ApiHandler {
  return async (request) => {
    const url = new URL(request.url);
    const open = gate.open[`${request.method} ${url.pathname}`];
    if (open) return openRoute(open, request, url);
    const asked = gate.access(request);
    const access = asked === 'visitor' && !gate.visitor ? 'signed-out' : asked;
    if (request.method === 'GET' && url.pathname === SESSION_PATH) {
      const session: SessionReport = { access, signIn: gate.signIn };
      return json(HTTP_OK, session);
    }
    if (access === 'owner') return gate.owner(request);
    if (access === 'visitor' && gate.visitor) return gate.visitor(request);
    return json(HTTP_UNAUTHORIZED, { error: 'sign in first', signIn: gate.signIn });
  };
}
