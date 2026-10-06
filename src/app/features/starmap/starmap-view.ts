import { BUCKETS, QUICK_COLOUR, SkyItem, isQuick } from './engine/sky-model';

/** The star map's screens: the review queue, the log sky, issues, usage and the weekly retro. */
export type Chart = 'prs' | 'logs' | 'issues' | 'usage' | 'retro';
export type SkyView = 'map' | 'list';

/** The address fragment names the screen, as pr-starmap's hash did. */
export function chartOf(fragment: string | null): Chart {
  if (fragment === 'logs') return 'logs';
  if (fragment?.startsWith('issues')) return 'issues';
  if (fragment === 'usage') return 'usage';
  if (fragment === 'retro') return 'retro';
  return 'prs';
}

export const fragmentOf = (chart: Chart): string | undefined =>
  chart === 'prs' ? undefined : chart;

const TITLES: Readonly<Record<Chart, string>> = {
  prs: 'Review Queue',
  logs: 'Log Sky',
  issues: 'Issues',
  usage: 'Usage',
  retro: 'Weekly retro',
};

export const titleOf = (chart: Chart): string => TITLES[chart];

/** Usage and the retro are lists with no sky behind them. */
export const isListOnly = (chart: Chart): boolean => chart === 'usage' || chart === 'retro';

/** One chip of the legend. */
export interface LegendChip {
  readonly id: string;
  readonly colour: string;
  readonly count: number;
  readonly text: string;
  /** Whether it has anything to light; an empty chip is faint and inert. */
  readonly live: boolean;
  /** Pressed by its own rule, where it toggles something rather than filtering. */
  readonly pressed?: boolean;
  readonly title?: string;
}

/** The review queue's legend: each bucket, then the quick wins across them. */
export function queueChips(items: readonly SkyItem[]): LegendChip[] {
  const counts = new Map<string, number>();
  for (const i of items) counts.set(i.bucket, (counts.get(i.bucket) ?? 0) + 1);
  const chips: LegendChip[] = BUCKETS.map((b) => {
    const count = counts.get(b.id) ?? 0;
    return { id: b.id, colour: b.colour, count, text: b.sub.toLowerCase(), live: count > 0 };
  });
  const quick = items.filter(isQuick).length;
  chips.push({
    id: 'quick',
    colour: QUICK_COLOUR,
    count: quick,
    text: 'quick wins',
    live: quick > 0,
  });
  return chips;
}

/** "anthonyturner/rivals_pulse · 18 open · refreshed 9/26/2026, 4:46:49 AM". */
export function queueStamp(
  repo: string,
  open: number,
  generatedAt: string | null,
  locale?: string,
): string {
  if (!generatedAt) return 'no data yet';
  return `${repo ? `${repo} · ` : ''}${open} open · refreshed ${new Date(generatedAt).toLocaleString(locale)}`;
}

/** Numbers as the page writes them: "3,122". */
export const fmtN = (n: number): string => Number(n).toLocaleString();
