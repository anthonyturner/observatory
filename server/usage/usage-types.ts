/** One limit window as the status line reported it at one moment. */
export interface WindowReading {
  readonly pct: number;
  readonly resetsAt: string;
}

/** One limit reading: either window may be missing from it. */
export interface LimitSample {
  readonly at: string;
  readonly week: WindowReading | null;
  readonly five: WindowReading | null;
}

export type Point = readonly [epochMs: number, percent: number];

export interface WeekProjection {
  readonly perHour: number;
  readonly atReset: number;
  readonly fullAt: string | null;
}

/** A limit window as the meters read it. */
export interface LimitWindow {
  readonly pct: number;
  readonly resetsAt: string;
  /** Its reset has passed since it was last read: the number is unknown now. */
  readonly expired: boolean;
  readonly points: readonly Point[];
  readonly projection?: WeekProjection | null;
}

/** The current week: a limit window that also knows when it began. */
export interface WeekWindow extends LimitWindow {
  readonly startsAt: string;
}

/** An earlier week, as far as it got before its reset. */
export interface PastWeek {
  readonly resetsAt: string;
  readonly peak: number;
}

export interface Limits {
  readonly at: string;
  readonly since: string;
  readonly week: WeekWindow | null;
  readonly five: LimitWindow | null;
  /** The weeks before this one, oldest first. */
  readonly weeks: readonly PastWeek[];
}

/** One assistant reply, counted once, with the largest usage it reported. */
export interface AssistantMessage {
  readonly id: string;
  readonly at: number;
  readonly model: string;
  readonly input: number;
  readonly output: number;
  readonly cacheRead: number;
  readonly cacheWrite: number;
  /** The session it was part of; empty when the log did not say. */
  readonly session: string;
  /** The working directory the session ran in; empty when the log did not say. */
  readonly cwd: string;
  /** The name of each tool it called, once per call. */
  readonly tools: readonly string[];
}

/** One local day of use. */
export interface TokenDay {
  readonly day: string;
  /** Work tokens (input, output and cache writes) by model family. */
  readonly families: Readonly<Record<string, number>>;
  readonly cacheRead: number;
  readonly messages: number;
  readonly sessions: number;
  readonly toolCalls: number;
  readonly subagents: number;
}

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
  /** Work tokens each day, oldest first. */
  readonly daily: readonly number[];
  /** How many folders this row stands for, when it folds several together. */
  readonly folded?: number;
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

/** What `GET /api/usage` returns. */
export interface UsageReport {
  readonly generatedAt: string;
  readonly limits: Limits | null;
  readonly tokens: TokenReport;
  /** The most-called tools, most first. */
  readonly tools: readonly ToolCount[];
  /** Busiest first, loose folders past the busiest few folded into one row. */
  readonly projects: readonly ProjectUsage[];
}
