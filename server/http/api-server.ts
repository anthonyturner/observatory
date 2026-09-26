import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';

/** Answers one GET route, given its query string, with a value to send as JSON. */
export type RouteHandler = (query: URLSearchParams) => Promise<unknown>;

export type Routes = Readonly<Record<string, RouteHandler>>;

/** Thrown by a route when the request itself is wrong: answered 400 with its message. */
export class BadRequest extends Error {}

function sendJson(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' });
  response.end(JSON.stringify(body));
}

async function handle(
  routes: Routes,
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  const url = new URL(request.url ?? '/', 'http://localhost');
  const route = request.method === 'GET' ? routes[url.pathname] : undefined;
  if (!route) {
    sendJson(response, 404, { error: 'not found' });
    return;
  }
  try {
    sendJson(response, 200, await route(url.searchParams));
  } catch (error) {
    if (error instanceof BadRequest) {
      sendJson(response, 400, { error: error.message });
      return;
    }
    console.error(error);
    sendJson(response, 500, { error: 'server error' });
  }
}

/** A JSON-over-HTTP server for GET routes, keyed by path. */
export function createApiServer(routes: Routes): Server {
  return createServer((request, response) => void handle(routes, request, response));
}
