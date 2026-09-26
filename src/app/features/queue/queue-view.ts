import { QUEUE_BUCKETS, QueueBucket, QueueItem, shownBucket } from '../../core/queue/queue-report';
import { QueueState } from '../../core/queue/queue-feed';
import { hoursMinutes, localDayKey } from '../../core/usage/usage-format';

/** How each bucket reads on the page: pr-starmap's star names, what they mean, their colour. */
export const BUCKET_LOOK: Record<
  QueueBucket,
  { name: string; meaning: string; why: string; color: string }
> = {
  conflicted: {
    name: 'Aporia',
    meaning: 'Cannot merge',
    why: 'Every merge into the base widens the gap.',
    color: 'var(--count-conflicted)',
  },
  failing: {
    name: 'Ruina',
    meaning: 'Checks failing',
    why: 'A check reported failure, error or timeout.',
    color: 'var(--count-failing)',
  },
  unknown: {
    name: 'Nebulosa',
    meaning: 'Mergeability unknown',
    why: 'GitHub has not settled whether this still merges.',
    color: 'var(--count-unknown)',
  },
  unlinked: {
    name: 'Vagrans',
    meaning: 'No issue linked',
    why: 'Merging it closes no issue, so the work reads as unfinished.',
    color: 'var(--count-unlinked)',
  },
  unreviewed: {
    name: 'Vigilia',
    meaning: 'Waiting on you',
    why: 'Ready for a review: oldest first.',
    color: 'var(--count-unreviewed)',
  },
  fresh: {
    name: 'Quies',
    meaning: 'Seen recently',
    why: 'You have looked at it: context, not a demand.',
    color: 'var(--ok)',
  },
};

/** A quick win is waiting on you and small enough to read in one sitting. */
export const QUICK_LINES = 200;
export const QUICK_FILTER = 'quick';

export type QueueFilter = QueueBucket | typeof QUICK_FILTER | null;

export const linesOf = (item: QueueItem): number | null =>
  item.additions === null ? null : item.additions + (item.deletions ?? 0);

export function isQuickWin(item: QueueItem): boolean {
  const lines = linesOf(item);
  const waiting = item.bucket === 'unreviewed';
  return waiting && lines !== null && lines <= QUICK_LINES;
}

/** Pull requests in the queue now: none dismissed or snoozed, unless asked for. */
export const visibleItems = (items: readonly QueueItem[], showHidden: boolean): QueueItem[] =>
  items.filter((item) => showHidden || item.hidden === null);

export const hiddenCount = (items: readonly QueueItem[]): number =>
  items.filter((item) => item.hidden !== null).length;

/** "snoozed until Sep 30" or "dismissed until it changes", for a hidden row. */
export function hiddenNote(item: QueueItem, locale?: string): string | null {
  if (!item.hidden) return null;
  if (item.hidden.reason === 'dismissed') return 'dismissed until it changes';
  const until = new Date(item.hidden.until).toLocaleDateString(locale, {
    month: 'short',
    day: 'numeric',
  });
  return `snoozed until ${until}`;
}

/** One row of the list. */
export interface QueueRow {
  readonly number: number;
  readonly title: string;
  readonly url: string;
  readonly isDraft: boolean;
  /** "closes #3 · idle 4d · +40 −2". */
  readonly detail: string;
  /** Why it is hidden, when it is shown anyway. */
  readonly hiddenNote: string | null;
}

export interface QueueSection {
  readonly bucket: QueueBucket;
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
  hiddenNote: hiddenNote(item),
});

/** The list, one section per bucket in order, narrowed by the filter. */
export function queueSections(items: readonly QueueItem[], filter: QueueFilter): QueueSection[] {
  return QUEUE_BUCKETS.filter((bucket) => !filter || filter === QUICK_FILTER || filter === bucket)
    .map((bucket) => ({
      bucket,
      name: BUCKET_LOOK[bucket].name,
      meaning: BUCKET_LOOK[bucket].meaning,
      color: BUCKET_LOOK[bucket].color,
      rows: items
        .filter(
          (item) => shownBucket(item) === bucket && (filter !== QUICK_FILTER || isQuickWin(item)),
        )
        .map(rowOf),
    }))
    .filter((section) => section.rows.length > 0);
}

/** A legend button per bucket, then quick wins, each with its count. */
export function queueLegend(items: readonly QueueItem[]): LegendEntry[] {
  const buckets = QUEUE_BUCKETS.map((bucket) => ({
    filter: bucket,
    label: BUCKET_LOOK[bucket].meaning.toLowerCase(),
    count: items.filter((item) => shownBucket(item) === bucket).length,
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
