import type { PullBucket } from '../projects/pull-counts.ts';
import type { QueueReport } from '../queue/queue-report.ts';

/** One open pull request in a frame. */
export interface FrameItem {
  readonly number: number;
  readonly title: string;
  readonly bucket: PullBucket;
}

export type Fate = 'merged' | 'closed';

/** A pull request that left the queue since the frame before. */
export interface Departed {
  readonly number: number;
  readonly title: string;
  readonly fate: Fate;
}

/** The queue as it stood at one refresh. GitHub keeps no history of
 *  mergeability, so frames are the only way to know a branch became blocked. */
export interface Frame {
  readonly at: string;
  readonly items: readonly FrameItem[];
  readonly departed: readonly Departed[];
}

/** One a day for four months, or many more on a busy day. */
export const MAX_FRAMES = 120;
/** A frame is recorded even when nothing moved once this much time has passed. */
export const QUIET_FRAME_MS = 12 * 3_600_000;
const TITLE_MAX = 90;

const clip = (title: string): string =>
  title.length > TITLE_MAX ? `${title.slice(0, TITLE_MAX - 1)}…` : title;

export const frameItemsOf = (report: QueueReport): FrameItem[] =>
  report.items.map((item) => ({
    number: item.number,
    title: clip(item.title),
    bucket: item.bucket,
  }));

const signature = (items: readonly FrameItem[]): string =>
  items
    .map((item) => `${item.number}:${item.bucket}`)
    .sort()
    .join(',');

/** Whether `items` is worth a frame after `previous`: something moved, or it has been quiet a while. */
export function isWorthRecording(
  previous: Frame | null,
  items: readonly FrameItem[],
  now: number,
): boolean {
  if (!previous) return true;
  if (signature(previous.items) !== signature(items)) return true;
  return now - Date.parse(previous.at) >= QUIET_FRAME_MS;
}

/** Pull requests in `previous` that are no longer open. */
export function leftSince(previous: Frame | null, items: readonly FrameItem[]): FrameItem[] {
  const open = new Set(items.map((item) => item.number));
  return (previous?.items ?? []).filter((item) => !open.has(item.number));
}

/** GitHub's state as a fate, or null for one still open (beyond the list's limit, say). */
export function fateFrom(state: string): Fate | null {
  if (state === 'MERGED') return 'merged';
  if (state === 'CLOSED') return 'closed';
  return null;
}
