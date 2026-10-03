import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PassThrough } from 'node:stream';
import { describe, it } from 'node:test';
import type { RunProcess } from '../../runner/claude-launcher.ts';
import type { AgentTool } from '../agent/agent-tool.ts';
import { OpenRouterError } from '../open-router-error.ts';
import { parseClaudeAnswer } from './claude-answer.ts';
import { claudeAgent, claudeFlags, promptFor } from './claude-agent.ts';
import { McpSessions } from './mcp-sessions.ts';

const openOrrery: AgentTool = {
  name: 'open_page',
  description: 'Opens a page.',
  parameters: { type: 'object' },
  run: async () => ({
    content: { opened: '/orrery' },
    effect: {
      kind: 'action',
      reply: { tier: 1, action: 'open-orrery', href: '/orrery', says: 'Opening the orrery' },
    },
  }),
};
const webSearch: AgentTool = { ...openOrrery, name: 'web_search' };

const envelope = (result: string, isError = false): string =>
  JSON.stringify({ type: 'result', is_error: isError, result });

/** A Claude Code that reads its prompt, may call a tool over its MCP session, and prints `output`. */
function fakeClaude(sessions: McpSessions, output: string, callTool: string | null = null) {
  const seen: { flags: readonly string[]; prompt: string; folder: string }[] = [];
  const start = (folder: string, flags: readonly string[]): RunProcess => {
    const stdin = new PassThrough();
    const stdout = new PassThrough();
    const stderr = new PassThrough();
    const closers: ((code: number | null) => void)[] = [];
    let prompt = '';
    stdin.on('data', (chunk: Buffer) => (prompt += chunk.toString()));
    stdin.on('end', async () => {
      seen.push({ flags, prompt, folder });
      const config = JSON.parse(readFileSync(flags[flags.indexOf('--mcp-config') + 1], 'utf8')) as {
        mcpServers: { observatory: { url: string } };
      };
      const token = config.mcpServers.observatory.url.split('/mcp/')[1];
      const session = sessions.find(token);
      if (callTool && session) {
        session.record(
          await session.tools.run({ id: '1', name: callTool, arguments: '{}' }, session.context),
        );
      }
      stdout.end(output);
      closers.forEach((close) => close(0));
    });
    return {
      pid: 1,
      stdin,
      stdout,
      stderr,
      onExit: () => undefined,
      onClose: (listener) => void closers.push(listener),
      onError: () => undefined,
    };
  };
  return { start, seen };
}

function agentWith(output: string, callTool: string | null = null) {
  const sessions = new McpSessions();
  const claude = fakeClaude(sessions, output, callTool);
  const agent = claudeAgent({
    start: claude.start,
    stop: () => undefined,
    tools: [openOrrery, webSearch],
    sessions,
    mcpUrl: (token) => `http://127.0.0.1:4319/mcp/${token}`,
    scratch: join(tmpdir(), 'observatory-jev-test'),
    now: () => new Date('2026-09-27T12:00:00Z'),
  });
  return { agent, seen: claude.seen, sessions };
}

const REQUEST = {
  text: 'AI news',
  history: [
    { role: 'user' as const, text: 'hello' },
    { role: 'assistant' as const, text: 'Hi.' },
  ],
  projects: [{ name: 'observatory', repo: 'me/observatory', href: '/p/me/observatory' }],
};

describe('claudeFlags', () => {
  it('restricts Claude Code to web search and Jev’s tools, and never to code', () => {
    const flags = claudeFlags('C:/tmp/x.mcp.json');
    assert.ok(flags.includes('--restricted'));
    assert.ok(flags.includes('--strict-mcp-config'));
    assert.equal(flags[flags.indexOf('--tools') + 1], 'WebSearch');
    const disallowed = flags.slice(
      flags.indexOf('--disallowedTools') + 1,
      flags.indexOf('--strict-mcp-config'),
    );
    for (const tool of [
      'Bash',
      'PowerShell',
      'Read',
      'Write',
      'Edit',
      'Glob',
      'Grep',
      'NotebookEdit',
      'WebFetch',
    ]) {
      assert.ok(disallowed.includes(tool), tool);
    }
    assert.equal(flags.includes('--dangerously-skip-permissions'), false);
  });

  it('never lets a turn fetch a page at an address of its choosing', () => {
    const flags = claudeFlags('C:/tmp/x.mcp.json');
    const allowed = flags.slice(
      flags.indexOf('--allowedTools') + 1,
      flags.indexOf('--disallowedTools'),
    );
    assert.equal(flags[flags.indexOf('--tools') + 1].includes('WebFetch'), false);
    assert.equal(allowed.includes('WebFetch'), false);
  });

  it('holds no character cmd.exe would act on, since a shim passes them through it', () => {
    for (const flag of claudeFlags('C:/tmp/x.mcp.json'))
      assert.doesNotMatch(flag, /["%^&|<>!\r\n]/);
  });
});

describe('promptFor', () => {
  it('puts who Jev is, the conversation and the new words on stdin', () => {
    const prompt = promptFor(REQUEST, new Date('2026-09-27T12:00:00Z'));
    assert.match(prompt, /You are Jev/);
    assert.match(prompt, /Owner: hello\nJev: Hi\./);
    assert.match(prompt, /The owner now says:\nAI news$/);
    assert.match(prompt, /observatory \(me\/observatory\)/);
    assert.doesNotMatch(prompt, /web_search/);
  });
});

describe('claudeAgent', () => {
  it('answers with Claude Code’s words and sources, and cleans up its session', async () => {
    const said = JSON.stringify({
      text: 'Two labs shipped models.',
      sources: [{ title: 'A', url: 'https://a.example/x' }],
    });
    const { agent, seen } = agentWith(envelope(said));
    const run = await agent.answer(REQUEST);
    assert.equal(run.text, 'Two labs shipped models.');
    assert.deepEqual(run.sources, [{ title: 'A', url: 'https://a.example/x' }]);
    assert.equal(run.effect, null);
    assert.match(seen[0].folder, /observatory-jev-test$/);
    assert.equal(seen[0].flags.includes('AI news'), false);
    assert.throws(() => readFileSync(seen[0].flags[seen[0].flags.indexOf('--mcp-config') + 1]));
  });

  it('brings back what a tool it called chose for the page', async () => {
    const { agent } = agentWith(
      envelope(JSON.stringify({ text: 'Opening it.', sources: [] })),
      'open_page',
    );
    const run = await agent.answer(REQUEST);
    assert.equal(run.effect?.kind, 'action');
  });

  it('never offers its own web_search, which would spend OpenRouter credit', async () => {
    const { agent } = agentWith(envelope(JSON.stringify({ text: 'x', sources: [] })), 'web_search');
    const run = await agent.answer(REQUEST);
    assert.equal(run.effect, null);
  });

  it('fails in words the router can use when Claude Code fails', async () => {
    const { agent } = agentWith(envelope('Not logged in', true));
    await assert.rejects(agent.answer(REQUEST), OpenRouterError);
  });
});

describe('parseClaudeAnswer', () => {
  it('reads the JSON answer, inside a fence or other words too', () => {
    const inner =
      '{"text":"Hi.","sources":[{"url":"https://b.example/","title":""},{"url":"javascript:1"}]}';
    assert.deepEqual(parseClaudeAnswer(envelope(`Here you go:\n\`\`\`json\n${inner}\n\`\`\``)), {
      text: 'Hi.',
      sources: [{ title: 'b.example', url: 'https://b.example/' }],
    });
  });

  it('takes plain words as the answer, with no sources', () => {
    assert.deepEqual(parseClaudeAnswer(envelope('Just words.')), {
      text: 'Just words.',
      sources: [],
    });
  });

  it('refuses output that is not Claude Code’s result', () => {
    assert.throws(() => parseClaudeAnswer('oops'), OpenRouterError);
  });
});
