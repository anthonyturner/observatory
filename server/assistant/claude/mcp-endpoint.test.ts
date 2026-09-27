import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { AgentTool, ToolResult } from '../agent/agent-tool.ts';
import { toolRegistry } from '../agent/tool-registry.ts';
import { withMcpEndpoint } from './mcp-endpoint.ts';
import { McpSessions } from './mcp-sessions.ts';

const echo: AgentTool = {
  name: 'echo',
  description: 'Says back what it was given.',
  parameters: { type: 'object', properties: { word: { type: 'string' } } },
  run: async (args) => ({
    content: { said: args['word'] },
    effect: {
      kind: 'action',
      reply: { tier: 1, action: 'open-orrery', href: '/orrery', says: 'Opening the orrery' },
    },
  }),
};

function setUp() {
  const sessions = new McpSessions();
  const recorded: ToolResult[] = [];
  const session = sessions.start({
    tools: toolRegistry([echo], () => undefined),
    context: { projects: [] },
    record: (result) => recorded.push(result),
  });
  const fallThrough = async () => new Response('api', { status: 200 });
  const handle = withMcpEndpoint(fallThrough, sessions);
  const post = (body: unknown, token = session.token, headers: Record<string, string> = {}) =>
    handle(
      new Request(`http://127.0.0.1:4319/mcp/${token}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', host: '127.0.0.1:4319', ...headers },
        body: JSON.stringify(body),
      }),
    );
  return { handle, post, session, recorded };
}

describe('withMcpEndpoint', () => {
  it('introduces itself as a tools server, echoing the protocol version asked for', async () => {
    const { post } = setUp();
    const response = await post({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: { protocolVersion: '2025-03-26' },
    });
    const { result } = (await response.json()) as { result: Record<string, unknown> };
    assert.equal(result['protocolVersion'], '2025-03-26');
    assert.deepEqual(result['capabilities'], { tools: { listChanged: false } });
  });

  it('accepts a notification with no answer', async () => {
    const { post } = setUp();
    const response = await post({ jsonrpc: '2.0', method: 'notifications/initialized' });
    assert.equal(response.status, 202);
  });

  it('lists the session’s tools with their schemas', async () => {
    const { post } = setUp();
    const response = await post({ jsonrpc: '2.0', id: 2, method: 'tools/list' });
    const { result } = (await response.json()) as { result: { tools: { name: string }[] } };
    assert.deepEqual(result.tools, [
      { name: 'echo', description: echo.description, inputSchema: echo.parameters },
    ]);
  });

  it('runs a tool, answers with its content, and records its effect for the request', async () => {
    const { post, recorded } = setUp();
    const response = await post({
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: { name: 'echo', arguments: { word: 'hi' } },
    });
    const { result } = (await response.json()) as {
      result: { content: { text: string }[]; isError: boolean };
    };
    assert.deepEqual(JSON.parse(result.content[0].text), { said: 'hi' });
    assert.equal(result.isError, false);
    assert.equal(recorded[0].effect?.kind, 'action');
  });

  it('tells the model about a tool that does not exist', async () => {
    const { post } = setUp();
    const response = await post({
      jsonrpc: '2.0',
      id: 4,
      method: 'tools/call',
      params: { name: 'rm' },
    });
    const { result } = (await response.json()) as { result: { isError: boolean } };
    assert.equal(result.isError, true);
  });

  it('refuses an unknown token, a closed session, a foreign origin or host, and a GET', async () => {
    const { post, session, handle } = setUp();
    assert.equal((await post({ jsonrpc: '2.0', id: 1, method: 'ping' }, 'guess')).status, 404);
    assert.equal(
      (
        await post({ jsonrpc: '2.0', id: 1, method: 'ping' }, session.token, {
          origin: 'https://evil.example',
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await post({ jsonrpc: '2.0', id: 1, method: 'ping' }, session.token, {
          host: 'evil.example',
        })
      ).status,
      403,
    );
    const get = await handle(
      new Request(`http://127.0.0.1:4319/mcp/${session.token}`, {
        headers: { host: '127.0.0.1:4319' },
      }),
    );
    assert.equal(get.status, 405);
    session.end();
    assert.equal((await post({ jsonrpc: '2.0', id: 1, method: 'ping' })).status, 404);
  });

  it('passes everything else to the API', async () => {
    const { handle } = setUp();
    const response = await handle(new Request('http://127.0.0.1:4319/api/projects'));
    assert.equal(await response.text(), 'api');
  });
});
