import { formatCount } from './log-format';
import { LOG_LEVELS, LogKey, logColour } from './log-levels';
import { LogSkyLayout } from './log-layout';
import { LogSnapshot } from './log-snapshot';

/** One legend button: press it to light only that kind of star. */
export interface LogLegendEntry {
  readonly key: LogKey;
  readonly count: number;
  /** `211` in the viewer's locale. */
  readonly countText: string;
  readonly label: string;
  /** Its colour as CSS. */
  readonly colour: string;
  /** Whether the sky has any such star to light; the button is faint if not. */
  readonly isLive: boolean;
}

/** Errors and warnings count occurrences, not distinct faults: "2,491
 *  warnings" is the number the log itself would give you. Quiet windows count
 *  the windows. */
export function logLegend(snapshot: LogSnapshot | null, layout: LogSkyLayout): LogLegendEntry[] {
  const has = (key: LogKey) => layout.stars.some((star) => star.key === key);
  const quiet = layout.stars.filter((star) => star.key === 'quiet').length;
  const counts: Record<LogKey, number> = {
    error: snapshot?.totals.error ?? 0,
    warn: snapshot?.totals.warn ?? 0,
    quiet,
  };
  return LOG_LEVELS.map(({ key, label }) => ({
    key,
    count: counts[key],
    countText: formatCount(counts[key]),
    label,
    colour: logColour(key),
    isLive: has(key),
  }));
}
