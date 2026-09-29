import {
  Json,
  isObject,
  isString,
  listOf,
  parseLimits,
  parseModel,
  parseProject,
  parseTokenDay,
  parseTool,
  parseTotals,
} from './usage-parse';

/** Where the week will stand at its reset if the recent pace holds. */
export interface WeekProjection {
  readonly atReset: number;
  /** Percent an hour, over the last two days. */
  readonly perHour?: number;
  /** When the week runs out at this pace, if before its reset. */
  readonly fullAt?: string;
}

/** One limit window: the five-hour or the weekly. */
export interface LimitWindow {
  readonly pct: number;
  readonly resetsAt: string;
  readonly expired?: boolean;
  /** [epoch ms, percent] readings, oldest first. */
  readonly points: readonly (readonly [number, number])[];
  readonly projection?: WeekProjection;
  /** When the window began; the report gives it for the week. */
  readonly startsAt?: string;
}

/** An earlier week, as far as it got before its reset. */
export interface PastWeek {
  readonly resetsAt: string;
  readonly peak: number;
}

export interface UsageLimits {
  readonly at?: string;
  readonly five?: LimitWindow;
  readonly week?: LimitWindow;
  /** The weeks before this one, oldest first. */
  readonly weeks: readonly PastWeek[];
}

/** One day of use: work tokens split by model family, and what lay behind them. */
export interface TokenDay {
  readonly day: string;
  readonly families: Readonly<Record<string, number>>;
  readonly cacheRead: number;
  readonly messages: number;
  readonly sessions: number;
  readonly toolCalls: number;
  readonly subagents: number;
}

/** A day's work tokens across every model family. */
export const workTokensOf = (row: TokenDay): number =>
  Object.values(row.families).reduce((sum, count) => sum + count, 0);

export interface TokenTotals {
  readonly tokens: number;
  readonly cacheRead: number;
  readonly messages: number;
  readonly sessions: number;
  readonly toolCalls: number;
  readonly subagents: number;
}

/** One model's use over the report's days. */
export interface ModelUsage {
  readonly model: string;
  readonly family: string;
  readonly input: number;
  readonly output: number;
  readonly cacheRead: number;
  readonly cacheWrite: number;
  readonly messages: number;
}

export interface ToolCount {
  readonly name: string;
  readonly count: number;
}

/** One project's use over the report's days. */
export interface ProjectUsage {
  readonly name: string;
  /** "owner/name" on GitHub, or null for a folder that is no repository. */
  readonly repo: string | null;
  readonly tokens: number;
  readonly cacheRead: number;
  readonly messages: number;
  readonly sessions: number;
}

export interface TokenReport {
  readonly days: number;
  /** The first day, "2026-08-28". */
  readonly from: string;
  readonly rows: readonly TokenDay[];
  readonly totals: TokenTotals;
  /** Busiest first. */
  readonly models: readonly ModelUsage[];
}

/** The usage report (`GET /api/usage`), as far as it could be read. */
export interface UsageDocument {
  readonly generatedAt: string;
  readonly limits?: UsageLimits;
  readonly tokens?: TokenReport;
  /** The most-called tools, most first. */
  readonly tools: readonly ToolCount[];
  /** Busiest first. */
  readonly projects: readonly ProjectUsage[];
}

function parseTokens(tokens: Json): TokenReport {
  const rows = listOf(tokens['rows'], parseTokenDay);
  const days = tokens['days'];
  return {
    days: typeof days === 'number' && Number.isInteger(days) && days > 0 ? days : rows.length,
    from: isString(tokens['from']) ? tokens['from'] : (rows[0]?.day ?? ''),
    rows,
    totals: parseTotals(tokens['totals']),
    models: listOf(tokens['models'], parseModel),
  };
}

/** Reads the report defensively: Claude Code calls its session-log format
 *  internal, so any field may be missing or change. Whatever does not parse
 *  is left out, to show as unknown rather than as a wrong number. */
export function parseUsageDocument(value: unknown): UsageDocument | null {
  if (!isObject(value) || !isString(value['generatedAt'])) return null;
  const limits = value['limits'];
  const tokens = value['tokens'];
  return {
    generatedAt: value['generatedAt'],
    limits: isObject(limits) ? parseLimits(limits) : undefined,
    tokens: isObject(tokens) ? parseTokens(tokens) : undefined,
    tools: listOf(value['tools'], parseTool),
    projects: listOf(value['projects'], parseProject),
  };
}
