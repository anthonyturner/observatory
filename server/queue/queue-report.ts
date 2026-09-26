import type { QueuePull, QueueReader } from '../github/queue-reader.ts';
import { type PullBucket, bucketOf, bucketRank, failingChecks } from '../projects/pull-counts.ts';
import { settleMergeable, type Sleep } from '../projects/settle-mergeable.ts';

const DAY_MS = 86_400_000;

/** One open pull request as the review queue lists it. */
export interface QueueItem {
  readonly number: number;
  readonly title: string;
  readonly url: string;
  readonly isDraft: boolean;
  readonly bucket: PullBucket;
  /** Issues it says it closes. */
  readonly closes: readonly number[];
  readonly failingChecks: number;
  readonly additions: number | null;
  readonly deletions: number | null;
  readonly updatedAt: string;
  readonly idleDays: number;
  readonly ageDays: number;
}

/** What `GET /api/queue` returns. */
export interface QueueReport {
  readonly generatedAt: string;
  readonly repo: string;
  readonly items: readonly QueueItem[];
}

const daysSince = (iso: string, now: number): number =>
  Math.max(0, Math.floor((now - Date.parse(iso)) / DAY_MS));

export function queueItemOf(pull: QueuePull, now: number): QueueItem {
  return {
    number: pull.number,
    title: pull.title,
    url: pull.url,
    isDraft: pull.isDraft,
    bucket: bucketOf(pull),
    closes: (pull.closingIssuesReferences ?? []).map((issue) => issue.number),
    failingChecks: failingChecks(pull),
    additions: pull.additions ?? null,
    deletions: pull.deletions ?? null,
    updatedAt: pull.updatedAt,
    idleDays: daysSince(pull.updatedAt, now),
    ageDays: daysSince(pull.createdAt, now),
  };
}

/** Most urgent bucket first; within one, the one untouched longest, so the
 *  backlog drains instead of being buried by each day's arrivals. */
export function rankQueue(items: readonly QueueItem[]): QueueItem[] {
  return [...items].sort(
    (a, b) =>
      bucketRank(a.bucket) - bucketRank(b.bucket) ||
      Date.parse(a.updatedAt) - Date.parse(b.updatedAt),
  );
}

/** A repository's open pull requests, ranked blocked first. */
export async function queueReport(
  github: QueueReader,
  repo: string,
  now = Date.now(),
  wait?: Sleep,
): Promise<QueueReport> {
  const pulls = await settleMergeable(github, repo, await github.queuePulls(repo), wait);
  return {
    generatedAt: new Date(now).toISOString(),
    repo,
    items: rankQueue(pulls.map((pull) => queueItemOf(pull, now))),
  };
}
