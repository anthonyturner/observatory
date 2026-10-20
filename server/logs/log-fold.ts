import { parseLogLine, shapeMessage, startsSession, type LogLine } from './log-line.ts';
import { occurrencesByWindow, splitByAge } from './log-stale.ts';
import type { FaultLevel, LogFault, LogLevel, LogSnapshot, LogWindow } from './log-types.ts';

/** Stars beyond this are the long tail; the totals still count them. Current and older faults
 *  are each capped at it, so a stale fault never takes a live one's place. */
export const MAX_FAULTS = 160;

type Counts = Record<LogLevel, number>;

interface WindowTally extends Counts {
  readonly id: string;
  lines: number;
  sessions: number;
  firstAt: string | null;
  lastAt: string | null;
}

interface FaultTally {
  readonly level: FaultLevel;
  readonly window: string;
  readonly service: string | null;
  readonly text: string;
  count: number;
  firstAt: string;
  lastAt: string;
  readonly days: Set<string>;
}

/** What the snapshot says about where it came from, beside what the lines say. */
export interface FoldSource {
  readonly generatedAt: string;
  /** The folder's own name. */
  readonly source: string;
  readonly files: number;
}

const earlier = (a: string | null, b: string): string => (a === null || b < a ? b : a);
const later = (a: string | null, b: string): string => (a === null || b > a ? b : a);

/** Errors first, then the most frequent. */
const louder = (a: FaultTally, b: FaultTally): number =>
  a.level === b.level ? b.count - a.count : a.level === 'error' ? -1 : 1;

/** The worst window first. `withOlder` in the browser (`log-older.ts`) ranks them the same
 *  way again once older faults rejoin the counts; keep the two in step. */
const worse = (a: LogWindow, b: LogWindow): number =>
  b.error - a.error || b.warn - a.warn || b.lines - a.lines;

/**
 * Folds a log folder's lines into one snapshot: counts for everything, and a
 * fault only for what went wrong, each distinct error or warning per window
 * with how often and when. A fault that stopped firing a day before the newest
 * line is set aside as older, and the counts leave it out. Raw lines never leave it.
 */
export class LogFold {
  private readonly clearedAt: string | null;
  private readonly windows = new Map<string, WindowTally>();
  private readonly faults = new Map<string, FaultTally>();
  private readonly days = new Map<string, { readonly day: string } & Counts>();
  private first: string | null = null;
  private last: string | null = null;

  /** A line logged at or before `clearedAt`, a log time (see `localTimeOf`), is not
   *  counted anywhere, so every figure restarts after it. */
  constructor(clearedAt: string | null = null) {
    this.clearedAt = clearedAt;
  }

  /** Counts a window even before, or without, any line of its own. */
  addWindow(id: string): void {
    this.tallyOf(id);
  }

  addLine(window: string, raw: string): void {
    const line = parseLogLine(raw);
    if (!line || this.isCleared(line)) return;
    this.count(this.tallyOf(window), line);
    if (line.level !== 'info') this.addFault(window, line, line.level);
  }

  snapshot(source: FoldSource): LogSnapshot {
    const { current, older } = splitByAge([...this.faults.values()].sort(louder), this.last);
    const kept = current.slice(0, MAX_FAULTS);
    const windows = this.windowsWithout(older);
    const sum = (key: 'lines' | LogLevel) =>
      windows.reduce((total, window) => total + window[key], 0);
    return {
      generatedAt: source.generatedAt,
      source: source.source,
      clearedAt: this.clearedAt,
      span: { from: this.first, to: this.last },
      totals: {
        lines: sum('lines'),
        files: source.files,
        error: sum('error'),
        warn: sum('warn'),
        info: sum('info'),
        faults: current.length,
        omitted: current.length - kept.length,
      },
      windows: windows.sort(worse),
      faults: kept.map((fault, index) => faultOf(fault, index)),
      older: {
        count: older.length,
        // Ranked after the current faults, so an id names one fault whether or not the older show.
        faults: older
          .slice(0, MAX_FAULTS)
          .map((fault, index) => faultOf(fault, kept.length + index)),
        windows: occurrencesByWindow(older),
      },
      timeline: [...this.days.values()]
        .map(({ day, error, warn, info }) => ({ day, error, warn, info }))
        .sort((a, b) => a.day.localeCompare(b.day)),
    };
  }

  /** Each window's tally less what the `older` faults fired in it. */
  private windowsWithout(older: readonly FaultTally[]): WindowTally[] {
    const gone = new Map(occurrencesByWindow(older).map((share) => [share.id, share]));
    return [...this.windows.values()].map((tally) => {
      const { error = 0, warn = 0 } = gone.get(tally.id) ?? {};
      return {
        ...tally,
        lines: tally.lines - error - warn,
        error: tally.error - error,
        warn: tally.warn - warn,
      };
    });
  }

  private isCleared(line: LogLine): boolean {
    return this.clearedAt !== null && line.at <= this.clearedAt;
  }

  private tallyOf(id: string): WindowTally {
    const known = this.windows.get(id);
    if (known) return known;
    const tally = {
      id,
      lines: 0,
      error: 0,
      warn: 0,
      info: 0,
      sessions: 0,
      firstAt: null,
      lastAt: null,
    };
    this.windows.set(id, tally);
    return tally;
  }

  private count(window: WindowTally, line: LogLine): void {
    window.lines++;
    window[line.level]++;
    if (startsSession(line)) window.sessions++;
    window.firstAt = earlier(window.firstAt, line.at);
    window.lastAt = later(window.lastAt, line.at);
    this.first = earlier(this.first, line.at);
    this.last = later(this.last, line.at);
    const day = this.days.get(line.day) ?? { day: line.day, error: 0, warn: 0, info: 0 };
    day[line.level]++;
    this.days.set(line.day, day);
  }

  private addFault(window: string, line: LogLine, level: FaultLevel): void {
    const { service, text } = shapeMessage(line.rest);
    const key = `${level}|${window}|${text}`;
    const fault = this.faults.get(key) ?? {
      level,
      window,
      service,
      text,
      count: 0,
      firstAt: line.at,
      lastAt: line.at,
      days: new Set<string>(),
    };
    fault.count++;
    fault.firstAt = earlier(fault.firstAt, line.at);
    fault.lastAt = later(fault.lastAt, line.at);
    fault.days.add(line.day);
    this.faults.set(key, fault);
  }
}

function faultOf(tally: FaultTally, index: number): LogFault {
  const { level, window, service, text, count, firstAt, lastAt, days } = tally;
  return {
    id: index + 1,
    level,
    window,
    service,
    text,
    count,
    firstAt,
    lastAt,
    activeDays: days.size,
  };
}
