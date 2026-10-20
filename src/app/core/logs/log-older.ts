import { LogSnapshot, LogWindow, NO_OLDER } from './log-snapshot';

/** The worst window first, the order the server ranks them in (`worse` in `log-fold.ts`) and the
 *  sky lays them out in. Adding the older counts can change the order, so it is ranked again here. */
const worse = (a: LogWindow, b: LogWindow): number =>
  b.error - a.error || b.warn - a.warn || b.lines - a.lines;

/**
 * The snapshot with its older faults counted back in: their occurrences rejoin the
 * windows and totals, and they rank after the current faults. Nothing is left over to
 * count, so the result has no older faults of its own.
 */
export function withOlder(snapshot: LogSnapshot): LogSnapshot {
  const { older, totals } = snapshot;
  if (older.count === 0) return snapshot;
  const back = new Map(older.windows.map((window) => [window.id, window]));
  const windows = snapshot.windows
    .map((window) => {
      const { error = 0, warn = 0 } = back.get(window.id) ?? {};
      return {
        ...window,
        lines: window.lines + error + warn,
        error: window.error + error,
        warn: window.warn + warn,
      };
    })
    .sort(worse);
  const sum = (key: 'error' | 'warn') =>
    older.windows.reduce((total, window) => total + window[key], 0);
  return {
    ...snapshot,
    totals: {
      ...totals,
      lines: totals.lines + sum('error') + sum('warn'),
      error: totals.error + sum('error'),
      warn: totals.warn + sum('warn'),
      faults: totals.faults + older.count,
      omitted: totals.omitted + older.count - older.faults.length,
    },
    windows,
    faults: [...snapshot.faults, ...older.faults],
    older: NO_OLDER,
  };
}
