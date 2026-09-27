import { familyOf, workTokens } from './token-days.ts';
import type {
  AssistantMessage,
  ModelUsage,
  TokenDay,
  TokenTotals,
  ToolCount,
} from './usage-types.ts';

/** The most-called tools the report keeps. */
export const TOP_TOOLS = 12;

const sum = (rows: readonly TokenDay[], count: (row: TokenDay) => number): number =>
  rows.reduce((total, row) => total + count(row), 0);

/** A day's work tokens, every model family together. */
export const familyTotal = (row: TokenDay): number =>
  Object.values(row.families).reduce((total, tokens) => total + tokens, 0);

/** The days' totals. Sessions are counted across the whole window, so one
 *  that ran past midnight counts once. */
export function tokenTotals(
  rows: readonly TokenDay[],
  messages: readonly AssistantMessage[],
): TokenTotals {
  const sessions = new Set(
    messages.flatMap((message) => (message.session ? [message.session] : [])),
  );
  return {
    tokens: sum(rows, familyTotal),
    cacheRead: sum(rows, (row) => row.cacheRead),
    messages: sum(rows, (row) => row.messages),
    sessions: sessions.size,
    toolCalls: sum(rows, (row) => row.toolCalls),
    subagents: sum(rows, (row) => row.subagents),
  };
}

const modelWork = (model: ModelUsage): number => model.input + model.output + model.cacheWrite;

/** Each model's use, the one that did the most work first. */
export function modelUsage(messages: readonly AssistantMessage[]): ModelUsage[] {
  const models = new Map<string, ModelUsage>();
  for (const message of messages) {
    const had = models.get(message.model);
    models.set(message.model, {
      model: message.model,
      family: familyOf(message.model),
      input: (had?.input ?? 0) + message.input,
      output: (had?.output ?? 0) + message.output,
      cacheRead: (had?.cacheRead ?? 0) + message.cacheRead,
      cacheWrite: (had?.cacheWrite ?? 0) + message.cacheWrite,
      messages: (had?.messages ?? 0) + 1,
    });
  }
  return [...models.values()].sort((a, b) => modelWork(b) - modelWork(a));
}

/** The most-called tools, most first. */
export function topTools(messages: readonly AssistantMessage[], limit = TOP_TOOLS): ToolCount[] {
  const counts = new Map<string, number>();
  for (const tool of messages.flatMap((message) => message.tools)) {
    counts.set(tool, (counts.get(tool) ?? 0) + 1);
  }
  return [...counts]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([name, count]) => ({ name, count }));
}
