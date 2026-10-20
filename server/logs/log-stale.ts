import { localTimeOf } from './log-line.ts';
import type { FaultLevel, LogOlder, LogOlderWindow } from './log-types.ts';

/** A fault last seen this long before the newest log line has stopped firing. */
export const STALE_AFTER_MS = 24 * 3_600_000;

/** What the split needs to know about a fault. */
export interface AgedFault {
  readonly level: FaultLevel;
  readonly window: string;
  readonly count: number;
  readonly lastAt: string;
}

/** No older faults: what a snapshot has when nothing stopped firing, or none was ever told. */
export const NO_OLDER: LogOlder = { count: 0, faults: [], windows: [] };

/** Splits faults by whether they fired within a day of `newest`, the newest line in the folder.
 *  The day is measured from that line, not from now, so an app that has not run for a while
 *  still shows its last faults instead of an empty sky. */
export function splitByAge<T extends AgedFault>(
  faults: readonly T[],
  newest: string | null,
): { readonly current: T[]; readonly older: T[] } {
  const newestAt = newest === null ? NaN : Date.parse(newest);
  if (Number.isNaN(newestAt)) return { current: [...faults], older: [] };
  const cutoff = localTimeOf(new Date(newestAt - STALE_AFTER_MS));
  return {
    current: faults.filter((fault) => fault.lastAt >= cutoff),
    older: faults.filter((fault) => fault.lastAt < cutoff),
  };
}

/** How many errors and warnings the `faults` fired in each window. */
export function occurrencesByWindow(faults: readonly AgedFault[]): LogOlderWindow[] {
  const byWindow = new Map<string, { error: number; warn: number }>();
  for (const { window, level, count } of faults) {
    const sum = byWindow.get(window) ?? { error: 0, warn: 0 };
    sum[level] += count;
    byWindow.set(window, sum);
  }
  return [...byWindow].map(([id, { error, warn }]) => ({ id, error, warn }));
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** The older faults of a pushed snapshot. One pushed before faults could be told apart by age
 *  has none, and so does anything that is not the shape of one; the page checks each fault
 *  again. */
export function olderFrom(value: unknown): LogOlder {
  if (!isObject(value)) return NO_OLDER;
  const { count, faults, windows } = value;
  return Number.isInteger(count) && Array.isArray(faults) && Array.isArray(windows)
    ? (value as unknown as LogOlder)
    : NO_OLDER;
}
