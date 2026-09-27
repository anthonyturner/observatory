import type { ChatMessage, ChatTurn, ToolCall } from '../chat-messages.ts';
import { OpenRouterError } from '../open-router-error.ts';
import type { OpenRouter } from '../open-router.ts';
import type { HistoryTurn, Project, Source } from '../route-contract.ts';
import type { AgentEffect, ToolContext, ToolResult } from './agent-tool.ts';
import { systemPrompt } from './agent-prompt.ts';
import type { ToolRegistry } from './tool-registry.ts';

/** The rounds of tool calls one request may take before Jev must answer. */
export const MAX_TOOL_ROUNDS = 6;
/** How long one request may take in all, every round together. */
export const AGENT_DEADLINE_MS = 45_000;

/** One request to Jev: the words, the conversation they continue, and the projects. */
export interface AgentRequest {
  readonly text: string;
  readonly history: readonly HistoryTurn[];
  readonly projects: readonly Project[];
}

/** What Jev said, and what its tools chose for the reply. */
export interface AgentRun {
  readonly text: string;
  /** The last page, op or proposal a tool chose, if any. */
  readonly effect: AgentEffect | null;
  readonly sources: readonly Source[];
}

export interface Agent {
  /** False with no key: then nothing is asked of it. */
  readonly isOn: boolean;
  /** How a reply names the model. */
  readonly by: string;
  /** Rejects with an OpenRouterError when the model cannot be had. */
  answer(request: AgentRequest): Promise<AgentRun>;
}

export interface AgentOptions {
  readonly models: OpenRouter;
  readonly tools: ToolRegistry;
  readonly now?: () => Date;
}

function openingMessages(request: AgentRequest, today: Date): ChatMessage[] {
  return [
    { role: 'system', content: systemPrompt(today, request.projects) },
    ...request.history.map((turn) => ({ role: turn.role, content: turn.text })),
    { role: 'user', content: request.text },
  ];
}

const said = (turn: ChatTurn): string => (turn.isCut ? `${turn.text}…` : turn.text);

/** What one request's tools chose, as they chose it: the last effect wins. */
class ToolOutcomes {
  private effect: AgentEffect | null = null;
  private readonly sources: Source[] = [];

  record(result: ToolResult): void {
    this.effect = result.effect ?? this.effect;
    this.sources.push(...(result.sources ?? []));
  }

  /** The run that ends with `turn`, or a shape error when it says and does nothing. */
  runEndingWith(turn: ChatTurn): AgentRun {
    if (!turn.text && !this.effect) throw new OpenRouterError('shape', 200, 'no text');
    return { text: said(turn), effect: this.effect, sources: [...this.sources] };
  }
}

const toolMessage = (call: ToolCall, result: ToolResult): ChatMessage => ({
  role: 'tool',
  toolCallId: call.id,
  content: JSON.stringify(result.content),
});

/**
 * Jev as an agent: the model answers in words, calling tools for the owner's
 * data and for anything it does on the page, until it has an answer. After
 * the last round it may only answer, so a request always ends.
 */
export function jevAgent(options: AgentOptions): Agent {
  const { models, tools, now = () => new Date() } = options;

  /** Each call's result, run one after another as the model listed them. */
  async function resultsOf(calls: readonly ToolCall[], context: ToolContext) {
    const results: ToolResult[] = [];
    for (const call of calls) results.push(await tools.run(call, context));
    return results;
  }

  async function answer(request: AgentRequest): Promise<AgentRun> {
    const deadline = now().getTime() + AGENT_DEADLINE_MS;
    const messages = openingMessages(request, now());
    const outcomes = new ToolOutcomes();
    const context: ToolContext = { projects: request.projects };
    for (let round = 0; ; round++) {
      if (now().getTime() > deadline) throw new OpenRouterError('timeout', null, 'agent deadline');
      const isLast = round === MAX_TOOL_ROUNDS;
      const turn = await models.chat({
        messages,
        tools: tools.specs,
        toolChoice: isLast ? 'none' : 'auto',
      });
      if (isLast || !turn.toolCalls.length) return outcomes.runEndingWith(turn);
      messages.push({ role: 'assistant', content: turn.text || null, toolCalls: turn.toolCalls });
      const results = await resultsOf(turn.toolCalls, context);
      results.forEach((result) => outcomes.record(result));
      messages.push(...turn.toolCalls.map((call, at) => toolMessage(call, results[at])));
    }
  }

  return { isOn: models.isOn, by: models.label, answer };
}
