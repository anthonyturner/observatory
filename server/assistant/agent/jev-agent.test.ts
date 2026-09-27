import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { OpenRouterError } from '../open-router-error.ts';
import { openRouter } from '../open-router.ts';
import type { Project } from '../route-contract.ts';
import type { AgentTool } from './agent-tool.ts';
import { AGENT_DEADLINE_MS, type AgentRequest, MAX_TOOL_ROUNDS, jevAgent } from './jev-agent.ts';
import { toolRegistry } from './tool-registry.ts';

const KEY = 'sk-or-v1-test-key';
const app: Project = { name: 'app', repo: 'me/app', href: '/p/me/app' };
const TODAY = new Date('2026-09-27T12:00:00Z');

interface WireCall {
  readonly id: string;
  readonly name: string;
  readonly args?: unknown;
}

const answers = (content: string) => () =>
  Response.json({ choices: [{ message: { content }, finish_reason: 'stop' }] });

const calls =
  (...wanted: WireCall[]) =>
  () =>
    Response.json({
      choices: [
        {
          message: {
            content: null,
            tool_calls: wanted.map(({ id, name, args = {} }) => ({
              id,
              type: 'function',
              function: { name, arguments: JSON.stringify(args) },
            })),
          },
          finish_reason: 'tool_calls',
        },
      ],
    });

/** A fetch that answers each call with the next scripted response, keeping each body sent. */
function scripted(...responses: (() => Response)[]) {
  const bodies: Record<string, unknown>[] = [];
  const fetch = (async (_url: string, init?: RequestInit) => {
    bodies.push(JSON.parse(String(init?.body)));
    const next = responses.shift();
    if (!next) throw new Error('no more responses');
    return next();
  }) as typeof globalThis.fetch;
  return { bodies, fetch };
}

/** A tool that answers with what it was given. */
const echoTool: AgentTool = {
  name: 'echo',
  description: 'Says back what it was given.',
  parameters: { type: 'object' },
  run: async (args) => ({ content: { heard: args } }),
};

const openUsage: AgentTool = {
  name: 'open_usage',
  description: 'Opens usage.',
  parameters: { type: 'object' },
  run: async () => ({
    content: { opening: 'Usage' },
    effect: {
      kind: 'action',
      reply: { tier: 1, action: 'show-usage', href: '/p/me/app#usage', says: 'Opening Usage' },
    },
    sources: [{ title: 'Usage', url: 'https://example.com/usage' }],
  }),
};

function agentWith(fetch: typeof globalThis.fetch, now: () => Date = () => TODAY) {
  return jevAgent({
    models: openRouter({ key: KEY, fetch, sleep: async () => undefined }),
    tools: toolRegistry([echoTool, openUsage], () => undefined),
    now,
  });
}

const request: AgentRequest = {
  text: 'what is a rebase',
  history: [
    { role: 'user', text: 'hi' },
    { role: 'assistant', text: 'Hello.' },
  ],
  projects: [app],
};

const messagesOf = (body: Record<string, unknown>) =>
  body['messages'] as { role: string; content: string | null; tool_call_id?: string }[];

describe('jevAgent', () => {
  it('answers in words with one call, after the prompt and the conversation so far', async () => {
    const { bodies, fetch } = scripted(answers('It replays commits.'));

    const run = await agentWith(fetch).answer(request);

    assert.deepEqual(run, { text: 'It replays commits.', effect: null, sources: [] });
    const messages = messagesOf(bodies[0]);
    assert.equal(messages[0].role, 'system');
    assert.match(String(messages[0].content), /27 September 2026/);
    assert.match(String(messages[0].content), /app \(me\/app\)/);
    assert.deepEqual(messages.slice(1), [
      { role: 'user', content: 'hi' },
      { role: 'assistant', content: 'Hello.' },
      { role: 'user', content: 'what is a rebase' },
    ]);
    assert.deepEqual(
      (bodies[0]['tools'] as { function: { name: string } }[]).map((tool) => tool.function.name),
      ['echo', 'open_usage'],
    );
  });

  it('runs a tool call, sends its result back, and answers with what the tool chose', async () => {
    const { bodies, fetch } = scripted(
      calls({ id: 'c1', name: 'open_usage' }),
      answers('Here is your usage.'),
    );

    const run = await agentWith(fetch).answer(request);

    assert.equal(run.text, 'Here is your usage.');
    assert.equal(run.effect?.kind, 'action');
    assert.deepEqual(run.sources, [{ title: 'Usage', url: 'https://example.com/usage' }]);
    const sentBack = messagesOf(bodies[1]).at(-1);
    assert.deepEqual(sentBack, {
      role: 'tool',
      tool_call_id: 'c1',
      content: '{"opening":"Usage"}',
    });
  });

  it('runs two tool calls from one turn, each answered by its own id', async () => {
    const { bodies, fetch } = scripted(
      calls({ id: 'a', name: 'echo', args: { n: 1 } }, { id: 'b', name: 'echo', args: { n: 2 } }),
      answers('Done.'),
    );

    await agentWith(fetch).answer(request);

    const tail = messagesOf(bodies[1]).slice(-2);
    assert.deepEqual(
      tail.map((message) => [message.tool_call_id, message.content]),
      [
        ['a', '{"heard":{"n":1}}'],
        ['b', '{"heard":{"n":2}}'],
      ],
    );
  });

  it('tells the model of a tool it got wrong, and carries on', async () => {
    const { bodies, fetch } = scripted(calls({ id: 'x', name: 'nope' }), answers('Sorry.'));

    await agentWith(fetch).answer(request);

    assert.equal(
      messagesOf(bodies[1]).at(-1)?.content,
      '{"error":"There is no tool called nope."}',
    );
  });

  it('after the last round of tools, asks for words only', async () => {
    const rounds = Array.from({ length: MAX_TOOL_ROUNDS }, (_, at) =>
      calls({ id: `c${at}`, name: 'echo' }),
    );
    const { bodies, fetch } = scripted(...rounds, answers('That took a while.'));

    const run = await agentWith(fetch).answer(request);

    assert.equal(run.text, 'That took a while.');
    assert.equal(bodies.length, MAX_TOOL_ROUNDS + 1);
    assert.deepEqual(
      bodies.map((body) => body['tool_choice']),
      [...rounds.map(() => 'auto'), 'none'],
    );
  });

  it('marks words cut off at the length cap', async () => {
    const { fetch } = scripted(() =>
      Response.json({ choices: [{ message: { content: 'A long' }, finish_reason: 'length' }] }),
    );

    assert.equal((await agentWith(fetch).answer(request)).text, 'A long…');
  });

  it('fails with the reason when OpenRouter does', async () => {
    const { fetch } = scripted(() => new Response('', { status: 402 }));

    await assert.rejects(
      agentWith(fetch).answer(request),
      (error: OpenRouterError) => error instanceof OpenRouterError && error.reason === 'credit',
    );
  });

  it('fails a turn that says nothing and does nothing', async () => {
    const { fetch } = scripted(answers('   '));

    await assert.rejects(
      agentWith(fetch).answer(request),
      (error: OpenRouterError) => error.reason === 'shape',
    );
  });

  it('stops with a timeout once the deadline has passed', async () => {
    const times = [0, 0, 0, AGENT_DEADLINE_MS + 1];
    const now = () => new Date(times.shift() ?? AGENT_DEADLINE_MS + 1);
    const { bodies, fetch } = scripted(calls({ id: 'c', name: 'echo' }), answers('late'));

    await assert.rejects(
      agentWith(fetch, now).answer(request),
      (error: OpenRouterError) => error.reason === 'timeout',
    );
    assert.equal(bodies.length, 1);
  });
});
