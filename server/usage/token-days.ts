import type { AssistantMessage, TokenDay } from './usage-types.ts';

const DAY_MS = 24 * 3_600_000;
const NOON_MS = 12 * 3_600_000;

/** Series are grouped by family, so a new model version keeps its family. */
const FAMILIES = ['opus', 'sonnet', 'haiku', 'fable'] as const;
/** The tools that start a subagent. */
const SUBAGENT_TOOLS: ReadonlySet<string> = new Set(['Agent', 'Task']);

export const familyOf = (model: string): string =>
  FAMILIES.find((family) => model.includes(family)) ?? 'other';

export const subagentsIn = (message: AssistantMessage): number =>
  message.tools.filter((tool) => SUBAGENT_TOOLS.has(tool)).length;

const twoDigits = (value: number): string => String(value).padStart(2, '0');

/** "2026-09-26": the local calendar day. */
export function localDayKey(epochMs: number): string {
  const date = new Date(epochMs);
  return `${date.getFullYear()}-${twoDigits(date.getMonth() + 1)}-${twoDigits(date.getDate())}`;
}

/** Local midnight at the start of the first of `days` days ending today. */
export function windowStart(now: number, days: number): number {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (days - 1));
  return start.getTime();
}

/** The `days` local days ending today, oldest first. */
export function dayKeys(now: number, days: number): string[] {
  const from = windowStart(now, days);
  // Noon, not midnight: a day-length step from noon stays inside the right
  // day across a daylight-saving change.
  return Array.from({ length: days }, (_, index) => localDayKey(from + index * DAY_MS + NOON_MS));
}

/** Tokens that took work: input, output and cache writes. Cache reads are
 *  counted apart by Claude Code and would swamp the rest. */
export const workTokens = (message: AssistantMessage): number =>
  message.input + message.output + message.cacheWrite;

interface DayTally {
  readonly families: Record<string, number>;
  cacheRead: number;
  messages: number;
  readonly sessions: Set<string>;
  toolCalls: number;
  subagents: number;
}

const emptyTally = (): DayTally => ({
  families: {},
  cacheRead: 0,
  messages: 0,
  sessions: new Set(),
  toolCalls: 0,
  subagents: 0,
});

function addTo(tally: DayTally, message: AssistantMessage): void {
  const family = familyOf(message.model);
  tally.families[family] = (tally.families[family] ?? 0) + workTokens(message);
  tally.cacheRead += message.cacheRead;
  tally.messages++;
  if (message.session) tally.sessions.add(message.session);
  tally.toolCalls += message.tools.length;
  tally.subagents += subagentsIn(message);
}

/** One row per local day, oldest first: each family's tokens that day, and
 *  the replies, sessions and tool calls behind them. A day with no messages
 *  is still a row, so the series has no holes. */
export function tokenDays(
  messages: readonly AssistantMessage[],
  now: number,
  days: number,
): TokenDay[] {
  const keys = dayKeys(now, days);
  const tallies = new Map(keys.map((key) => [key, emptyTally()]));
  for (const message of messages) {
    const tally = tallies.get(localDayKey(message.at));
    if (tally) addTo(tally, message);
  }
  return keys.map((day) => {
    const { sessions, ...tally } = tallies.get(day) ?? emptyTally();
    return { day, ...tally, sessions: sessions.size };
  });
}
