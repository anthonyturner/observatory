import { How, isHow } from './history-report';

/** What became of a pull request's review threads. */
export interface ThreadCounts {
  readonly resolved: number;
  readonly unresolved: number;
}

/** How a pull request ended, as `GET /api/pull-state` reads it once it has left the queue. */
export interface PullEnding {
  readonly how: How;
  readonly threads: ThreadCounts;
  /** The numbers of the issues it closed. */
  readonly closes: readonly number[];
}

type Json = Record<string, unknown>;

const isObject = (value: unknown): value is Json => typeof value === 'object' && value !== null;
const isCount = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0;

/** Reads an ending defensively; null when it is absent or not one. */
export function parsePullEnding(value: unknown): PullEnding | null {
  if (!isObject(value) || !isHow(value['how'])) return null;
  const threads = value['threads'];
  if (!isObject(threads) || !isCount(threads['resolved']) || !isCount(threads['unresolved'])) {
    return null;
  }
  const closes = value['closes'];
  return {
    how: value['how'],
    threads: { resolved: threads['resolved'], unresolved: threads['unresolved'] },
    closes: Array.isArray(closes) ? closes.filter(isCount) : [],
  };
}
