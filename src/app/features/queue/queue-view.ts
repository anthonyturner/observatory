import { PULL_BUCKETS, PullBucket } from '../../core/projects/projects-report';
import { QueueState } from '../../core/queue/queue-feed';
import { QueueItem } from '../../core/queue/queue-report';
import { hoursMinutes, localDayKey } from '../../core/usage/usage-format';

/** How each bucket reads on the page: pr-starmap's star names, what they mean, their colour. */
export const BUCKET_LOOK: Record<PullBucket, { name: string; meaning: string; color: string }> = {
  conflicted: { name: 'Aporia', meaning: 'Cannot merge', color: 'var(--count-conflicted)' },
  failing: { name: 'Ruina', meaning: 'Checks failing', color: 'var(--count-failing)' },
  unknown: { name: 'Nebulosa', meaning: 'Mergeability unknown', color: 'var(--count-unknown)' },
  unlinked: { name: 'Vagrans', meaning: 'No issue linked', color: 'var(--count-unlinked)' },
  unreviewed: { name: 'Vigilia', meaning: 'Waiting on you', color: 'var(--count-unreviewed)' },
};

/** A quick win is waiting on you and small enough to read in one sitting. */
export const QUICK_LINES = 200;
export const QUICK_FILTER = 'quick';

export type QueueFilter = PullBucket | typeof QUICK_FILTER | null;

export const linesOf = (item: QueueItem): number | null =>
  item.additions === null ? null : item.additions + (item.deletions ?? 0);

export function isQuickWin(item: QueueItem): boolean {
  const lines = linesOf(item);
  return item.bucket === 'unreviewed' && lines !== null && lines <= QUICK_LINES;
}

/** One row of the list. */
export interface QueueRow {
  readonly number: number;
  readonly title: string;
  readonly url: string;
  readonly isDraft: boolean;
  /** "closes #3 · idle 4d · +40 −2". */
  readonly detail: string;
}

export interface QueueSection {
  readonly bucket: PullBucket;
  readonly name: string;
  readonly meaning: string;
  readonly color: string;
  readonly rows: readonly QueueRow[];
}

/** One button of the legend: a bucket, or quick wins. */
export interface LegendEntry {
  readonly filter: Exclude<QueueFilter, null>;
  readonly label: string;
  readonly count: number;
  readonly color: string;
}

function detailOf(item: QueueItem): string {
  const closes = item.closes.length
    ? `closes ${item.closes.map((issue) => `#${issue}`).join(' ')}`
    : 'closes nothing';
  const size =
    item.additions === null ? 'size unknown' : `+${item.additions} −${item.deletions ?? 0}`;
  return `${closes} · idle ${item.idleDays}d · ${size}`;
}

const rowOf = (item: QueueItem): QueueRow => ({
  number: item.number,
  title: item.title,
  url: item.url,
  isDraft: item.isDraft,
  detail: detailOf(item),
});

/** The list, one section per bucket in order, narrowed by the filter. */
export function queueSections(items: readonly QueueItem[], filter: QueueFilter): QueueSection[] {
  return PULL_BUCKETS.filter((bucket) => !filter || filter === QUICK_FILTER || filter === bucket)
    .map((bucket) => ({
      bucket,
      ...BUCKET_LOOK[bucket],
      rows: items
        .filter((item) => item.bucket === bucket && (filter !== QUICK_FILTER || isQuickWin(item)))
        .map(rowOf),
    }))
    .filter((section) => section.rows.length > 0);
}

/** A legend button per bucket, then quick wins, each with its count. */
export function queueLegend(items: readonly QueueItem[]): LegendEntry[] {
  const buckets = PULL_BUCKETS.map((bucket) => ({
    filter: bucket,
    label: BUCKET_LOOK[bucket].meaning.toLowerCase(),
    count: items.filter((item) => item.bucket === bucket).length,
    color: BUCKET_LOOK[bucket].color,
  }));
  return [
    ...buckets,
    {
      filter: QUICK_FILTER,
      label: 'quick wins',
      count: items.filter(isQuickWin).length,
      color: 'var(--queue-quick)',
    },
  ];
}

const UNREAD: Record<Exclude<QueueState['status'], 'ready' | 'refused'>, string> = {
  reading: 'reading the queue',
  unreachable: 'API out of reach',
};

/** "me/a · 5 open · refreshed 09:42", with the date for an older read. */
export function queueStamp(state: QueueState, now: number, locale?: string): string {
  if (state.status === 'refused') return state.reason;
  if (state.status !== 'ready') return UNREAD[state.status];
  const { repo, items, generatedAt } = state.report;
  const at = Date.parse(generatedAt);
  const when =
    localDayKey(at) === localDayKey(now)
      ? hoursMinutes(at)
      : `${new Date(at).toLocaleDateString(locale, { day: 'numeric', month: 'short' })} ${hoursMinutes(at)}`;
  return `${repo} · ${items.length} open · refreshed ${when}`;
}
