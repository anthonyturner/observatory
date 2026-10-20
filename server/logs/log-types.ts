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
  /** Distinct current faults, charted or not. */
  readonly faults: number;
  /** Faults past the chart's cap, counted in the totals only. */
  readonly omitted: number;
}

/** One window's share of the older faults: what showing them adds back to its counts. */
export interface LogOlderWindow {
  readonly id: string;
  readonly error: number;
  readonly warn: number;
}

/** The faults that stopped firing a day or more before the newest log line. The snapshot's
 *  totals, windows and faults leave them out; this carries them so showing them needs no
 *  second request. */
export interface LogOlder {
  /** Distinct older faults, listed or not. */
  readonly count: number;
  /** Capped like the current ones, ranked after them. */
  readonly faults: readonly LogFault[];
  /** Their occurrences, by window, however many fall past the cap. */
  readonly windows: readonly LogOlderWindow[];
}

/** What `GET /api/logs` answers for a configured folder: pr-starmap's `logs/current`. */
export interface LogSnapshot {
  readonly generatedAt: string;
  /** The folder's own name, e.g. `Rivals Pulse`. */
  readonly source: string;
  /** When the owner last cleared the sky, as a log time: nothing at or before it is counted. */
  readonly clearedAt: string | null;
  readonly span: { readonly from: string | null; readonly to: string | null };
  readonly totals: LogTotals;
  readonly windows: readonly LogWindow[];
  readonly faults: readonly LogFault[];
  readonly older: LogOlder;
  /** Every day since the clear, the older faults' occurrences included. */
  readonly timeline: readonly LogDay[];
}

/** Why there is no snapshot: no folder recorded, or the recorded one is gone. */
export interface LogsUnconfigured {
  readonly configured: false;
  readonly reason: 'not-set' | 'not-found';
}
