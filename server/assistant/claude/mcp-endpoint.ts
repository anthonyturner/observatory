import type { ApiHandler } from '../../http/api-handler.ts';
import type { McpSession, McpSessions } from './mcp-sessions.ts';

/* A minimal MCP server over HTTP, for the Claude Code that Jev starts: it
   lists one request's tools and runs them, so page actions and proposals come
   back to the request as they do for the OpenRouter agent. Only what Claude
   Code asks of a tools-only server is answered: initialize, tools/list,
   tools/call and ping, one JSON answer to each POST. */

export const MCP_PREFIX = '/mcp/';

const HTTP_OK = 200;
const HTTP_ACCEPTED = 202;
const HTTP_FORBIDDEN = 403;
const HTTP_NOT_FOUND = 404;
const HTTP_NOT_ALLOWED = 405;
const HTTP_TOO_LARGE = 413;
const MAX_BODY_BYTES = 256 * 1024;
const LOOPBACK_HOSTS: ReadonlySet<string> = new Set(['localhost', '127.0.0.1', '[::1]']);
const PROTOCOL_VERSION = '2025-06-18';
const SERVER_INFO = { name: 'observatory', version: '1.0.0' };
const METHOD_NOT_FOUND = -32601;
const INVALID_REQUEST = -32600;

type Json = Readonly<Record<string, unknown>>;
const isObject = (value: unknown): value is Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const jsonAnswer = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const hostOf = (value: string | null): string | null => {
  if (!value) return null;
  try {
    return new URL(value.includes('://') ? value : `http://${value}`).hostname;
  } catch {
    return null;
  }
};

/** Claude Code on this machine sends no Origin; a page elsewhere always does. */
function isFromThisMachine(request: Request): boolean {
  const host = hostOf(request.headers.get('host'));
  if (!host || !LOOPBACK_HOSTS.has(host)) return false;
  const origin = request.headers.get('origin');
  return origin === null || LOOPBACK_HOSTS.has(hostOf(origin) ?? '');
}

/** The answer to one JSON-RPC message, or null for a notification. */
async function answerTo(message: unknown, session: McpSession): Promise<unknown> {
  if (!isObject(message) || typeof message['method'] !== 'string') {
    return { jsonrpc: '2.0', id: null, error: { code: INVALID_REQUEST, message: 'not a request' } };
  }
  const { id, method } = message;
  if (id === undefined) return null;
  const params = isObject(message['params']) ? message['params'] : {};
  const reply = (result: unknown) => ({ jsonrpc: '2.0', id, result });
  switch (method) {
    case 'initialize':
      return reply({
        protocolVersion:
          typeof params['protocolVersion'] === 'string'
            ? params['protocolVersion']
            : PROTOCOL_VERSION,
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVER_INFO,
      });
    case 'ping':
      return reply({});
    case 'tools/list':
      return reply({
        tools: session.tools.specs.map(({ name, description, parameters }) => ({
          name,
          description,
          inputSchema: parameters,
        })),
      });
    case 'tools/call':
      return reply(await callTool(params, session));
    default:
      return {
        jsonrpc: '2.0',
        id,
        error: { code: METHOD_NOT_FOUND, message: `no method ${method}` },
      };
  }
}

/** Runs one tool through the request's registry, which already turns a bad
 *  call or a failed read into an error the model can read. */
async function callTool(params: Json, session: McpSession): Promise<unknown> {
  const name = typeof params['name'] === 'string' ? params['name'] : '';
  const args = isObject(params['arguments']) ? params['arguments'] : {};
  const result = await session.tools.run(
    { id: `mcp-${name}`, name, arguments: JSON.stringify(args) },
    session.context,
  );
  session.record(result);
  const isError = isObject(result.content) && 'error' in result.content;
  return { content: [{ type: 'text', text: JSON.stringify(result.content) }], isError };
}

async function bodyOf(request: Request): Promise<unknown> {
  const bytes = await request.arrayBuffer();
  if (bytes.byteLength > MAX_BODY_BYTES) throw new RangeError('too large');
  return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
}

/** `handle`, with `/mcp/<token>` answered as the MCP server of the request that token names. */
export function withMcpEndpoint(handle: ApiHandler, sessions: McpSessions): ApiHandler {
  return async (request) => {
    const path = new URL(request.url).pathname;
    if (!path.startsWith(MCP_PREFIX)) return handle(request);
    if (!isFromThisMachine(request)) return jsonAnswer(HTTP_FORBIDDEN, { error: 'forbidden' });
    const session = sessions.find(path.slice(MCP_PREFIX.length));
    if (!session) return jsonAnswer(HTTP_NOT_FOUND, { error: 'no such session' });
    if (request.method !== 'POST') {
      return new Response(null, { status: HTTP_NOT_ALLOWED, headers: { allow: 'POST' } });
    }
    let body: unknown;
    try {
      body = await bodyOf(request);
    } catch (error) {
      if (error instanceof RangeError) return jsonAnswer(HTTP_TOO_LARGE, { error: 'too large' });
      return jsonAnswer(HTTP_OK, {
        jsonrpc: '2.0',
        id: null,
        error: { code: -32700, message: 'parse error' },
      });
    }
    const messages = Array.isArray(body) ? body : [body];
    const answers = (
      await Promise.all(messages.map((message) => answerTo(message, session)))
    ).filter((answer) => answer !== null);
    if (!answers.length) return new Response(null, { status: HTTP_ACCEPTED });
    return jsonAnswer(HTTP_OK, Array.isArray(body) ? answers : answers[0]);
  };
}
