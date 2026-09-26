import { formatAt, formatCount } from './log-format';
import { LogFilter, logColour } from './log-levels';
import { LogSkyLayout, LogStar, windowKey } from './log-layout';

/** One fault as a row: `×1,204  <message>  error · last Sep 26, 04:12 AM · burning`. */
export interface LogListRow {
  readonly star: LogStar;
  readonly id: number;
  readonly count: string;
  readonly text: string;
  readonly info: string;
  /** Its colour as CSS. */
  readonly colour: string;
}

/** One window's faults, under its name. */
export interface LogListSection {
  readonly label: string;
  readonly colour: string;
  /** `41 errors · 132 warnings · 50,357 lines`. */
  readonly sub: string;
  readonly rows: readonly LogListRow[];
}

/** One section per window, worst window first, each fault a row. A window
 *  with nothing to list under the filter is left out. */
export function logListSections(
  layout: LogSkyLayout,
  filter: LogFilter,
  locale?: string,
): LogListSection[] {
  return layout.clusters.flatMap((cluster): LogListSection[] => {
    const rows = cluster.stars
      .filter((star) => star.kind === 'fault' && (!filter || star.key === filter))
      .flatMap((star) => rowOf(star, locale));
    if (!rows.length) return [];
    const { error, warn, lines } = cluster.win;
    return [
      {
        label: cluster.label,
        colour: logColour(windowKey(cluster.win)),
        sub:
          `${formatCount(error, locale)} errors · ${formatCount(warn, locale)} warnings` +
          ` · ${formatCount(lines, locale)} lines`,
        rows,
      },
    ];
  });
}

function rowOf(star: LogStar, locale?: string): LogListRow[] {
  const { fault } = star;
  if (!fault) return [];
  return [
    {
      star,
      id: fault.id,
      count: `×${formatCount(fault.count, locale)}`,
      text: fault.text,
      info:
        `${fault.level === 'error' ? 'error' : 'warning'} · last ${formatAt(fault.lastAt, locale)}` +
        (star.urgent ? ' · burning' : ''),
      colour: logColour(star.key),
    },
  ];
}
