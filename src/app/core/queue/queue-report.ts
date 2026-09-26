import { PULL_BUCKETS, PullBucket } from '../projects/projects-report';

/** The queue's groups: GitHub's buckets, and Seen recently for a waiting
 *  pull request you have marked seen. */
export type QueueBucket = PullBucket | 'fresh';

/** Why a pull request is out of the queue for now. */
export type Hidden =
  { readonly reason: 'dismissed' } | { readonly reason: 'snoozed'; readonly until: string };

/** One open pull request as the review queue lists it. */
export interface QueueItem {
  readonly number: number;
  readonly title: string;
  readonly url: string;
  readonly isDraft: boolean;
  readonly bucket: PullBucket;
  readonly closes: readonly number[];
  readonly failingChecks: number;
  readonly additions: number | null;
  readonly deletions: number | null;
  readonly idleDays: number;
  readonly ageDays: number;
  /** The head branch, or empty when GitHub did not say. */
  readonly branch: string;
  /** GitHub's own word: MERGEABLE, CONFLICTING or UNKNOWN. */
  readonly mergeable: string;
  readonly changedFiles: number | null;
  /** Marked seen on this machine. */
  readonly isSeen: boolean;
  /** Dismissed or snoozed on this machine, or null when it is in the queue. */
  readonly hidden: Hidden | null;
}

/** The group a pull request shows in: a seen, waiting one is Seen recently. */
export const shownBucket = (item: QueueItem): QueueBucket =>
  item.bucket === 'unreviewed' && item.isSeen ? 'fresh' : item.bucket;

/** What `GET /api/queue` returns. */
export interface QueueReport {
  readonly generatedAt: string;
  readonly repo: string;
  readonly items: readonly QueueItem[];
}

type Json = Record<string, unknown>;

const isObject = (value: unknown): value is Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const isCount = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0;
const isString = (value: unknown): value is string => typeof value === 'string';
const isBucket = (value: unknown): value is PullBucket =>
  (PULL_BUCKETS as readonly unknown[]).includes(value);
/** Only links to GitHub are followed from the page. */
const isGitHubUrl = (value: unknown): value is string =>
  isString(value) && value.startsWith('https://github.com/');
const countOrNull = (value: unknown): number | null => (isCount(value) ? value : null);

function parseHidden(value: unknown): Hidden | null {
  if (!isObject(value)) return null;
  if (value['reason'] === 'dismissed') return { reason: 'dismissed' };
  if (value['reason'] === 'snoozed' && isString(value['until'])) {
    return { reason: 'snoozed', until: value['until'] };
  }
  return null;
}

function parseItem(value: unknown): QueueItem | null {
  if (!isObject(value)) return null;
  const { number, title, url, bucket, idleDays, ageDays, failingChecks } = value;
  if (!isCount(number) || !isString(title) || !isGitHubUrl(url) || !isBucket(bucket)) return null;
  const closes = Array.isArray(value['closes']) ? value['closes'].filter(isCount) : [];
  return {
    number,
    title,
    url,
    isDraft: value['isDraft'] === true,
    bucket,
    closes,
    failingChecks: isCount(failingChecks) ? failingChecks : 0,
    additions: countOrNull(value['additions']),
    deletions: countOrNull(value['deletions']),
    idleDays: isCount(idleDays) ? idleDays : 0,
    ageDays: isCount(ageDays) ? ageDays : 0,
    branch: isString(value['branch']) ? value['branch'] : '',
    mergeable: isString(value['mergeable']) ? value['mergeable'] : 'UNKNOWN',
    changedFiles: countOrNull(value['changedFiles']),
    isSeen: value['isSeen'] === true,
    hidden: parseHidden(value['hidden']),
  };
}

/** Reads the report defensively; an item that does not parse is left out. */
export function parseQueueReport(value: unknown): QueueReport | null {
  if (!isObject(value) || !isString(value['generatedAt']) || !isString(value['repo'])) return null;
  if (!Array.isArray(value['items'])) return null;
  return {
    generatedAt: value['generatedAt'],
    repo: value['repo'],
    items: value['items'].map(parseItem).filter((item): item is QueueItem => item !== null),
  };
}
