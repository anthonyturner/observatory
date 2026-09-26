export type LogLevel = 'error' | 'warn' | 'info';
/** The levels a fault can have: info is counted, never charted. */
export type FaultLevel = Exclude<LogLevel, 'info'>;

/** One window that writes a log, with its line counts by level. */
export interface LogWindow {
  readonly id: string;
  readonly lines: number;
  readonly error: number;
  readonly warn: number;
  readonly info: number;
  readonly sessions: number;
  readonly firstAt: string | null;
  readonly lastAt: string | null;
}

/** One distinct error or warning in one window, however often it fired. */
export interface LogFault {
  /** 1 for the loudest; the order the chart keeps them in. */
  readonly id: number;
  readonly level: FaultLevel;
  readonly window: string;
  readonly service: string | null;
  readonly text: string;
  readonly count: number;
  readonly firstAt: string;
  readonly lastAt: string;
  readonly activeDays: number;
}

/** One calendar day's lines by level. */
export interface LogDay {
  readonly day: string;
  readonly error: number;
  readonly warn: number;
  readonly info: number;
}

export interface LogTotals {
  readonly lines: number;
  readonly files: number;
  readonly error: number;
  readonly warn: number;
  readonly info: number;
  /** Distinct faults, charted or not. */
  readonly faults: number;
  /** Faults past the chart's cap, counted in the totals only. */
  readonly omitted: number;
}

/** What `GET /api/logs` answers for a configured folder: pr-starmap's `logs/current`. */
export interface LogSnapshot {
  readonly generatedAt: string;
  /** The folder's own name, e.g. `Rivals Pulse`. */
  readonly source: string;
  readonly span: { readonly from: string | null; readonly to: string | null };
  readonly totals: LogTotals;
  readonly windows: readonly LogWindow[];
  readonly faults: readonly LogFault[];
  readonly timeline: readonly LogDay[];
}

/** Why there is no snapshot: no folder recorded, or the recorded one is gone. */
export interface LogsUnconfigured {
  readonly configured: false;
  readonly reason: 'not-set' | 'not-found';
}
