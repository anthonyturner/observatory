import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { AgentTool, ToolResult } from '../agent/agent-tool.ts';
import type { Agent, AgentRequest, AgentRun } from '../agent/jev-agent.ts';
import { systemPrompt } from '../agent/agent-prompt.ts';
import { toolRegistry } from '../agent/tool-registry.ts';
import { OpenRouterError } from '../open-router-error.ts';
import type { RunProcess } from '../../runner/claude-launcher.ts';
import type { AgentEffect } from '../agent/agent-tool.ts';
import type { Source } from '../route-contract.ts';
import type { McpSessions } from './mcp-sessions.ts';
import { parseClaudeAnswer } from './claude-answer.ts';

/** Starts Claude Code in `folder` with `flags`; the prompt goes on its stdin. */
export type StartClaude = (folder: string, flags: readonly string[]) => RunProcess;

export interface ClaudeAgentOptions {
  readonly start: StartClaude;
  /** Jev's own tools. Web search is Claude Code's, so its web_search is left out. */
  readonly tools: readonly AgentTool[];
  readonly sessions: McpSessions;
  /** Where a session's MCP server answers, for the Claude Code started for it. */
  readonly mcpUrl: (token: string) => string;
  /** A neutral folder Claude Code runs in: never a checkout. */
  readonly scratch: string;
  /** Ends a Claude Code that ran past the deadline, and everything it started. */
  readonly stop: (pid: number) => void;
  readonly now?: () => Date;
}

/** A turn can search the web and call tools, each a round trip: slower than a
 *  single model call, so it is given longer. */
export const CLAUDE_DEADLINE_MS = 90_000;
/** Haiku keeps a turn quick; the answers are short. */
const MODEL = 'haiku';
export const MCP_SERVER = 'observatory';
/** Claude Code's own: the web, and nothing that reads or changes this machine. */
const WEB_TOOLS = ['WebSearch', 'WebFetch'] as const;
const NEVER_TOOLS = ['Bash', 'PowerShell', 'Read', 'Write', 'Edit', 'Glob', 'Grep', 'NotebookEdit'];
const HIS_OWN_SEARCH = 'web_search';
const BY = 'Claude Code · Haiku';

/** The flags Claude Code starts with. Fixed words and one file path only: a
 *  batch shim passes them through cmd.exe, and what a person typed never does. */
export function claudeFlags(mcpConfigFile: string): string[] {
  return [
    '-p',
    // No tool that runs code, and none of the owner's settings, hooks or plugins.
    '--restricted',
    '--model',
    MODEL,
    '--output-format',
    'json',
    '--no-session-persistence',
    '--tools',
    WEB_TOOLS.join(','),
    '--allowedTools',
    `mcp__${MCP_SERVER}`,
    ...WEB_TOOLS,
    '--disallowedTools',
    ...NEVER_TOOLS,
    '--strict-mcp-config',
    '--mcp-config',
    mcpConfigFile,
  ];
}

const ANSWER_SHAPE = [
  'Reply with only one JSON object and nothing else, no code fence:',
  '{"text": "your answer, plain text that reads well aloud", "sources": [{"title": "…", "url": "https://…"}]}',
  'List in sources the pages you used from a web search or fetch, most useful first, at most five; otherwise [].',
  `For the owner's projects, pull requests, issues and usage, and to open a page, refresh, show help or propose a task, use the ${MCP_SERVER} tools. For news and anything current, use WebSearch.`,
].join('\n');

/** What Claude Code reads on stdin: who Jev is, the conversation, the new words. */
export function promptFor(request: AgentRequest, today: Date): string {
  const history = request.history
    .map((turn) => `${turn.role === 'user' ? 'Owner' : 'Jev'}: ${turn.text}`)
    .join('\n');
  return [
    systemPrompt(today, request.projects).replaceAll('web_search', 'WebSearch'),
    ANSWER_SHAPE,
    history ? `The conversation so far:\n${history}` : '',
    `The owner now says:\n${request.text}`,
  ]
    .filter(Boolean)
    .join('\n\n');
}

/** What one request's tools chose: the last effect wins, as in the OpenRouter agent. */
class Outcomes {
  effect: AgentEffect | null = null;
  readonly sources: Source[] = [];

  record(result: ToolResult): void {
    this.effect = result.effect ?? this.effect;
    this.sources.push(...(result.sources ?? []));
  }
}

/** Collects what a process writes, and settles when it ends or runs out of time. */
function outputOf(
  child: RunProcess,
  deadlineMs: number,
  stop: (pid: number) => void,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    child.stdout.on('data', (chunk: Buffer) => chunks.push(chunk));
    child.stderr.resume();
    const timer = setTimeout(() => {
      if (child.pid !== undefined) stop(child.pid);
      reject(new OpenRouterError('timeout', null, 'claude -p ran past its deadline'));
    }, deadlineMs);
    child.onError((error) => {
      clearTimeout(timer);
      reject(new OpenRouterError('upstream', null, `claude -p did not start: ${error.message}`));
    });
    child.onClose(() => {
      clearTimeout(timer);
      resolve(Buffer.concat(chunks).toString('utf8'));
    });
  });
}

/**
 * Jev on the owner's Claude Code subscription: `claude -p`, restricted to the
 * web and Jev's own tools, which it reaches through this request's MCP session.
 */
export function claudeAgent(options: ClaudeAgentOptions): Agent {
  const { start, sessions, scratch, stop, now = () => new Date() } = options;
  const tools = toolRegistry(options.tools.filter((tool) => tool.name !== HIS_OWN_SEARCH));

  async function answer(request: AgentRequest): Promise<AgentRun> {
    mkdirSync(scratch, { recursive: true });
    const outcomes = new Outcomes();
    const session = sessions.start({
      tools,
      context: { projects: request.projects },
      record: (result) => outcomes.record(result),
    });
    const configFile = join(scratch, `jev-${session.token}.mcp.json`);
    try {
      writeFileSync(
        configFile,
        JSON.stringify({
          mcpServers: { [MCP_SERVER]: { type: 'http', url: options.mcpUrl(session.token) } },
        }),
      );
      const child = start(scratch, claudeFlags(configFile));
      const output = outputOf(child, CLAUDE_DEADLINE_MS, stop);
      child.stdin.end(promptFor(request, now()));
      const said = parseClaudeAnswer(await output);
      if (!said.text && !outcomes.effect) throw new OpenRouterError('shape', 200, 'no text');
      return {
        text: said.text,
        effect: outcomes.effect,
        sources: [...outcomes.sources, ...said.sources],
      };
    } finally {
      session.end();
      rmSync(configFile, { force: true });
    }
  }

  return { isOn: true, by: BY, answer };
}
