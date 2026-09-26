import { parseLogLine, shapeMessage, startsSession, type LogLine } from './log-line.ts';
import type { FaultLevel, LogFault, LogLevel, LogSnapshot, LogWindow } from './log-types.ts';

/** Stars beyond this are the long tail; the totals still count them. */
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

/** The worst window first. */
const worse = (a: LogWindow, b: LogWindow): number =>
  b.error - a.error || b.warn - a.warn || b.lines - a.lines;

/**
 * Folds a log folder's lines into one snapshot: counts for everything, and a
 * fault only for what went wrong, each distinct error or warning per window
 * with how often and when. Raw lines never leave it.
 */
export class LogFold {
  private readonly windows = new Map<string, WindowTally>();
  private readonly faults = new Map<string, FaultTally>();
  private readonly days = new Map<string, { readonly day: string } & Counts>();
  private first: string | null = null;
  private last: string | null = null;
  private lines = 0;

  /** Counts a window even before, or without, any line of its own. */
  addWindow(id: string): void {
    this.tallyOf(id);
  }

  addLine(window: string, raw: string): void {
    const line = parseLogLine(raw);
    if (!line) return;
    this.count(this.tallyOf(window), line);
    if (line.level !== 'info') this.addFault(window, line, line.level);
  }

  snapshot(source: FoldSource): LogSnapshot {
    const windows = [...this.windows.values()].map((tally) => ({ ...tally }));
    const all = [...this.faults.values()].sort(louder);
    const kept = all.slice(0, MAX_FAULTS);
    const sum = (level: LogLevel) => windows.reduce((total, window) => total + window[level], 0);
    return {
      generatedAt: source.generatedAt,
      source: source.source,
      span: { from: this.first, to: this.last },
      totals: {
        lines: this.lines,
        files: source.files,
        error: sum('error'),
        warn: sum('warn'),
        info: sum('info'),
        faults: all.length,
        omitted: all.length - kept.length,
      },
      windows: windows.sort(worse),
      faults: kept.map(faultOf),
      timeline: [...this.days.values()]
        .map(({ day, error, warn, info }) => ({ day, error, warn, info }))
        .sort((a, b) => a.day.localeCompare(b.day)),
    };
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
    this.lines++;
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
