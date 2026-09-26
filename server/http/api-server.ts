import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';

/** Answers one GET route, given its query string, with a value to send as JSON. */
export type RouteHandler = (query: URLSearchParams) => Promise<unknown>;

/** Answers one POST route, given its parsed JSON body. */
export type PostHandler = (body: unknown) => Promise<unknown>;

export type Routes = Readonly<Record<string, RouteHandler>>;
export type PostRoutes = Readonly<Record<string, PostHandler>>;

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

function sendJson(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' });
  response.end(JSON.stringify(body));
}

async function readJson(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    size += (chunk as Buffer).length;
    if (size > MAX_BODY_BYTES) throw new BadRequest('body too large');
    chunks.push(chunk as Buffer);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new BadRequest('body must be JSON');
  }
}

async function answer(response: ServerResponse, produce: () => Promise<unknown>): Promise<void> {
  try {
    sendJson(response, 200, await produce());
  } catch (error) {
    if (error instanceof BadRequest) {
      sendJson(response, 400, { error: error.message });
      return;
    }
    console.error(error);
    sendJson(response, 500, { error: 'server error' });
  }
}

async function handle(
  routes: Routes,
  posts: PostRoutes,
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  const url = new URL(request.url ?? '/', 'http://localhost');
  const get = request.method === 'GET' ? routes[url.pathname] : undefined;
  const post = request.method === 'POST' ? posts[url.pathname] : undefined;
  if (get) return answer(response, () => get(url.searchParams));
  if (!post) return sendJson(response, 404, { error: 'not found' });
  if (request.headers[WRITE_HEADER] !== '1') {
    return sendJson(response, 403, { error: 'forbidden' });
  }
  if (!String(request.headers['content-type']).startsWith('application/json')) {
    return sendJson(response, 415, { error: 'body must be application/json' });
  }
  return answer(response, async () => post(await readJson(request)));
}

/** A JSON-over-HTTP server: GET routes by path, and POST routes guarded by WRITE_HEADER. */
export function createApiServer(routes: Routes, posts: PostRoutes = {}): Server {
  return createServer((request, response) => void handle(routes, posts, request, response));
}
