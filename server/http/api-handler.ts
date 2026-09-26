/** Answers one GET route, given its query string, with a value to send as JSON. */
export type RouteHandler = (query: URLSearchParams) => Promise<unknown>;

/** Answers one POST route, given its parsed JSON body. */
export type PostHandler = (body: unknown) => Promise<unknown>;

export type Routes = Readonly<Record<string, RouteHandler>>;
export type PostRoutes = Readonly<Record<string, PostHandler>>;

/** Every route one kind of caller may use, by path. */
export interface RouteTable {
  readonly get: Routes;
  readonly post: PostRoutes;
}

/** A standard web request in, a response out: the same under Node and in a Vercel function. */
export type ApiHandler = (request: Request) => Promise<Response>;

/** Thrown by a route when the request itself is wrong: answered 400 with its message. */
export class BadRequest extends Error {}

/**
 * A write must carry this header. A page on another site cannot add a custom
 * header to a request here without a preflight this server never grants, so
 * only Observatory's own page (proxied, same origin) can change anything.
 */
export const WRITE_HEADER = 'x-observatory';
/** A write's body is a few fields; anything larger is not one. */
const MAX_BODY_BYTES = 16 * 1024;

const HTTP_OK = 200;
const HTTP_BAD_REQUEST = 400;
const HTTP_FORBIDDEN = 403;
const HTTP_NOT_FOUND = 404;
const HTTP_UNSUPPORTED_MEDIA = 415;
const HTTP_SERVER_ERROR = 500;

/** A JSON response that no cache keeps. */
export function json(
  status: number,
  body: unknown,
  extraHeaders: ConstructorParameters<typeof Headers>[0] = {},
): Response {
  const headers = new Headers(extraHeaders);
  headers.set('content-type', 'application/json');
  headers.set('cache-control', 'no-store');
  return new Response(JSON.stringify(body), { status, headers });
}

/** A request's JSON body, or a BadRequest when it is too large or not JSON. */
async function readJson(request: Request, maxBytes = MAX_BODY_BYTES): Promise<unknown> {
  const bytes = await request.arrayBuffer();
  if (bytes.byteLength > maxBytes) throw new BadRequest('body too large');
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new BadRequest('body must be JSON');
  }
}

/** Runs a route, turning what it throws into the status it stands for. */
async function answer(produce: () => Promise<unknown>): Promise<Response> {
  try {
    return json(HTTP_OK, await produce());
  } catch (error) {
    if (error instanceof BadRequest) return json(HTTP_BAD_REQUEST, { error: error.message });
    console.error(error);
    return json(HTTP_SERVER_ERROR, { error: 'server error' });
  }
}

const isJson = (request: Request): boolean =>
  (request.headers.get('content-type') ?? '').startsWith('application/json');

/** JSON over HTTP: GET routes by path, and POST routes guarded by WRITE_HEADER. */
export function createApiHandler(table: RouteTable): ApiHandler {
  return async (request) => {
    const url = new URL(request.url);
    const get = request.method === 'GET' ? table.get[url.pathname] : undefined;
    const post = request.method === 'POST' ? table.post[url.pathname] : undefined;
    if (get) return answer(() => get(url.searchParams));
    if (!post) return json(HTTP_NOT_FOUND, { error: 'not found' });
    if (request.headers.get(WRITE_HEADER) !== '1') {
      return json(HTTP_FORBIDDEN, { error: 'forbidden' });
    }
    if (!isJson(request)) {
      return json(HTTP_UNSUPPORTED_MEDIA, { error: 'body must be application/json' });
    }
    return answer(async () => post(await readJson(request)));
  };
}
