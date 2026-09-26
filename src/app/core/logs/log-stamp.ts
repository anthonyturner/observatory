import { formatCount, formatDay, formatRefreshed } from './log-format';
import { LogSkyLayout } from './log-layout';
import { LogSnapshot } from './log-snapshot';

const NO_DAY = '—';

/** The line beside the title: `Rivals Pulse · 776,900 lines · Jun 21 → Sep 26
 *  · 38 still burning · refreshed 9/26/2026, 4:49:12 AM`. The page sets it in
 *  capitals. */
export function logStamp(
  snapshot: LogSnapshot | null,
  layout: LogSkyLayout,
  locale?: string,
): string {
  if (!snapshot) return 'no logs yet';
  const hot = layout.stars.filter((star) => star.kind === 'fault' && star.urgent).length;
  const { from, to } = snapshot.span;
  const day = (at: string | null) => (at ? formatDay(at, locale) : NO_DAY);
  return (
    `${snapshot.source} · ${formatCount(snapshot.totals.lines, locale)} lines · ${day(from)} → ${day(to)}` +
    ` · ${hot} still burning · refreshed ${formatRefreshed(snapshot.generatedAt, locale)}`
  );
}
