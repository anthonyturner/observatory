/** A level a fault can have. */
export type FaultLevel = 'error' | 'warn';

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
  readonly id: number;
  readonly level: FaultLevel;
  readonly window: string;
  readonly service: string | null;
  readonly text: string;
  readonly count: number;
  /** `2026-09-23T01:43:37`, local to the machine that wrote the log. */
  readonly firstAt: string;
  readonly lastAt: string;
  readonly activeDays: number;
}

/** One calendar day's lines by level; `day` is `2026-09-23`. */
export interface LogDay {
  readonly day: string;
  readonly error: number;
  readonly warn: number;
  readonly info: number;
}

/** One window's share of the older faults: what showing them adds back to its counts. */
export interface LogOlderWindow {
  readonly id: string;
  readonly error: number;
  readonly warn: number;
}

/** The faults that stopped firing a day before the newest log line, kept out of the figures
 *  around them until they are shown. */
export interface LogOlder {
  /** Distinct older faults, listed or not. */
  readonly count: number;
  readonly faults: readonly LogFault[];
  /** Their occurrences by window, the ones past the list's cap too. */
  readonly windows: readonly LogOlderWindow[];
}

export const NO_OLDER: LogOlder = { count: 0, faults: [], windows: [] };

export interface LogTotals {
  readonly lines: number;
  readonly files: number;
  readonly error: number;
  readonly warn: number;
  readonly info: number;
  /** Distinct current faults. */
  readonly faults: number;
  /** Faults past the chart's cap, counted in the totals only. */
  readonly omitted: number;
}

/** An app's log folder, folded: what `GET /api/logs` answers. */
export interface LogSnapshot {
  readonly generatedAt: string;
  /** The folder's own name, e.g. `Rivals Pulse`. */
  readonly source: string;
  /** When the sky was last cleared, as a log time: nothing at or before it is counted. */
  readonly clearedAt: string | null;
  readonly span: { readonly from: string | null; readonly to: string | null };
  readonly totals: LogTotals;
  readonly windows: readonly LogWindow[];
  readonly faults: readonly LogFault[];
  readonly older: LogOlder;
  /** Every day since the clear, the older faults' occurrences included. */
  readonly timeline: readonly LogDay[];
}

/** No folder is recorded for the repository, or the recorded one is gone. */
export interface LogsUnconfigured {
  readonly configured: false;
  readonly reason: 'not-set' | 'not-found';
}

type Json = Record<string, unknown>;

const isObject = (value: unknown): value is Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const isCount = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0;
const isString = (value: unknown): value is string => typeof value === 'string';
const countOf = (value: unknown): number => (isCount(value) ? value : 0);
const stringOrNull = (value: unknown): string | null => (isString(value) ? value : null);
/** A log time, `2026-09-23T01:43:37`: the one form a clear is kept in. */
const LOG_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/;
const logTimeOrNull = (value: unknown): string | null =>
  isString(value) && LOG_TIME.test(value) ? value : null;
const listOf = <T>(value: unknown, parse: (item: unknown) => T | null): T[] =>
  Array.isArray(value) ? value.map(parse).filter((item): item is T => item !== null) : [];

function parseWindow(value: unknown): LogWindow | null {
  if (!isObject(value) || !isString(value['id'])) return null;
  return {
    id: value['id'],
    lines: countOf(value['lines']),
    error: countOf(value['error']),
    warn: countOf(value['warn']),
    info: countOf(value['info']),
    sessions: countOf(value['sessions']),
    firstAt: stringOrNull(value['firstAt']),
    lastAt: stringOrNull(value['lastAt']),
  };
}

function parseFault(value: unknown): LogFault | null {
  if (!isObject(value)) return null;
  const { id, level, window, text, firstAt, lastAt } = value;
  if (!isCount(id) || (level !== 'error' && level !== 'warn')) return null;
  if (!isString(window) || !isString(text) || !isString(firstAt) || !isString(lastAt)) return null;
  return {
    id,
    level,
    window,
    service: stringOrNull(value['service']),
    text,
    count: countOf(value['count']),
    firstAt,
    lastAt,
    activeDays: countOf(value['activeDays']),
  };
}

function parseDay(value: unknown): LogDay | null {
  if (!isObject(value) || !isString(value['day'])) return null;
  return {
    day: value['day'],
    error: countOf(value['error']),
    warn: countOf(value['warn']),
    info: countOf(value['info']),
  };
}

function parseOlderWindow(value: unknown): LogOlderWindow | null {
  if (!isObject(value) || !isString(value['id'])) return null;
  return { id: value['id'], error: countOf(value['error']), warn: countOf(value['warn']) };
}

/** A snapshot from before faults were told apart by age has none older. */
function parseOlder(value: unknown): LogOlder {
  const older = isObject(value) ? value : {};
  return {
    count: countOf(older['count']),
    faults: listOf(older['faults'], parseFault),
    windows: listOf(older['windows'], parseOlderWindow),
  };
}

function parseTotals(value: unknown): LogTotals {
  const totals = isObject(value) ? value : {};
  return {
    lines: countOf(totals['lines']),
    files: countOf(totals['files']),
    error: countOf(totals['error']),
    warn: countOf(totals['warn']),
    info: countOf(totals['info']),
    faults: countOf(totals['faults']),
    omitted: countOf(totals['omitted']),
  };
}

/** Reads the answer defensively: a snapshot, the reason there is none, or
 *  null for anything else. A window, fault or day that does not parse is left out. */
export function parseLogsResponse(value: unknown): LogSnapshot | LogsUnconfigured | null {
  if (!isObject(value)) return null;
  if (value['configured'] === false) {
    return { configured: false, reason: value['reason'] === 'not-found' ? 'not-found' : 'not-set' };
  }
  if (!isString(value['generatedAt']) || !isString(value['source'])) return null;
  const span = isObject(value['span']) ? value['span'] : {};
  return {
    generatedAt: value['generatedAt'],
    source: value['source'],
    clearedAt: logTimeOrNull(value['clearedAt']),
    span: { from: stringOrNull(span['from']), to: stringOrNull(span['to']) },
    totals: parseTotals(value['totals']),
    windows: listOf(value['windows'], parseWindow),
    faults: listOf(value['faults'], parseFault),
    older: parseOlder(value['older']),
    timeline: listOf(value['timeline'], parseDay),
  };
}

export const isLogSnapshot = (value: LogSnapshot | LogsUnconfigured | null): value is LogSnapshot =>
  value !== null && !('configured' in value);
