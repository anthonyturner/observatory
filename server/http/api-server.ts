import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';

/** Answers one GET route with a value to send as JSON. */
export type RouteHandler = () => Promise<unknown>;

export type Routes = Readonly<Record<string, RouteHandler>>;

function sendJson(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' });
  response.end(JSON.stringify(body));
}

async function handle(
  routes: Routes,
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  const path = new URL(request.url ?? '/', 'http://localhost').pathname;
  const route = request.method === 'GET' ? routes[path] : undefined;
  if (!route) {
    sendJson(response, 404, { error: 'not found' });
    return;
  }
  try {
    sendJson(response, 200, await route());
  } catch (error) {
    console.error(error);
    sendJson(response, 500, { error: 'server error' });
  }
}

/** A JSON-over-HTTP server for GET routes, keyed by path. */
export function createApiServer(routes: Routes): Server {
  return createServer((request, response) => void handle(routes, request, response));
}
