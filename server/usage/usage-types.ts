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

export interface Limits {
  readonly at: string;
  readonly since: string;
  readonly week: LimitWindow | null;
  readonly five: LimitWindow | null;
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
}

export interface TokenDay {
  readonly day: string;
  readonly families: Readonly<Record<string, number>>;
}

/** What `GET /api/usage` returns. */
export interface UsageReport {
  readonly generatedAt: string;
  readonly limits: Limits | null;
  readonly tokens: { readonly days: number; readonly rows: readonly TokenDay[] };
}
