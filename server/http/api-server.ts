import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { ApiHandler } from './api-handler.ts';

const HTTP_SERVER_ERROR = 500;

async function toRequest(incoming: IncomingMessage): Promise<Request> {
  const chunks: Buffer[] = [];
  for await (const chunk of incoming) chunks.push(chunk as Buffer);
  const headers = new Headers();
  for (const [name, value] of Object.entries(incoming.headers)) {
    for (const each of [value ?? []].flat()) headers.append(name, each);
  }
  const hasBody = incoming.method !== 'GET' && incoming.method !== 'HEAD';
  return new Request(`http://${incoming.headers.host ?? 'localhost'}${incoming.url ?? '/'}`, {
    method: incoming.method,
    headers,
    body: hasBody ? Buffer.concat(chunks) : undefined,
  });
}

async function send(outgoing: ServerResponse, response: Response): Promise<void> {
  const headers = new Headers(response.headers);
  // Node joins repeated headers with commas, which breaks cookies; give it each one.
  const cookies = headers.getSetCookie();
  headers.delete('set-cookie');
  outgoing.writeHead(response.status, {
    ...Object.fromEntries(headers),
    ...(cookies.length ? { 'set-cookie': cookies } : {}),
  });
  await sendBody(outgoing, response.body);
}

/** Writes `body` as it arrives, so a streamed response reaches the page line by line. */
async function sendBody(
  outgoing: ServerResponse,
  body: ReadableStream<Uint8Array> | null,
): Promise<void> {
  if (!body) return void outgoing.end();
  const reader = body.getReader();
  const cancel = (): void => void reader.cancel().catch((error: unknown) => console.error(error));
  // A caller that goes away ends the stream, which tells its source to stop. One
  // that left while the route was still answering closed before anyone listened.
  if (outgoing.closed) return cancel();
  outgoing.on('close', cancel);
  for (let chunk = await reader.read(); !chunk.done; chunk = await reader.read()) {
    outgoing.write(chunk.value);
  }
  outgoing.end();
}

/** `handle` behind Node's own HTTP server. Nothing it throws stops the server. */
export function createApiServer(handle: ApiHandler): Server {
  return createServer((incoming, outgoing) => {
    toRequest(incoming)
      .then(handle)
      .then((response) => send(outgoing, response))
      .catch((error: unknown) => {
        console.error(error);
        if (outgoing.headersSent) return void outgoing.destroy();
        outgoing.writeHead(HTTP_SERVER_ERROR, { 'content-type': 'application/json' });
        outgoing.end(JSON.stringify({ error: 'server error' }));
      });
  });
}
