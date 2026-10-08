import { isNumber, isObject, isText, listOf } from '../json/json-fields';

/** One lesson from a review, and the comment on the pull request that holds it. */
export interface JournalEntry {
  readonly pull: number;
  /** The review comment's page on GitHub. */
  readonly url: string;
  /** Milliseconds since the epoch. */
  readonly postedAt: number;
  readonly firstVersion: string;
  readonly feedback: string;
  /** What changed on the redo, and why. */
  readonly change: string;
  /** Ids from the principles list. */
  readonly principles: readonly string[];
}

/** What `GET /api/journal` returns. */
export interface JournalReport {
  readonly generatedAt: number;
  readonly repo: string;
  /** Newest first. */
  readonly entries: readonly JournalEntry[];
}

const HTTPS = /^https:\/\//;

/** A time given as ISO text, in milliseconds, or null when it is not one. */
const timeOf = (value: unknown): number | null => {
  const ms = isText(value) ? Date.parse(value) : NaN;
  return Number.isFinite(ms) ? ms : null;
};

function parseEntry(value: unknown): JournalEntry | null {
  if (!isObject(value)) return null;
  const { pull, url, firstVersion, feedback, change, principles } = value;
  const postedAt = timeOf(value['postedAt']);
  if (
    !isNumber(pull) ||
    !isText(url) ||
    !HTTPS.test(url) ||
    postedAt === null ||
    !isText(firstVersion) ||
    !isText(feedback) ||
    !isText(change)
  ) {
    return null;
  }
  return {
    pull,
    url,
    postedAt,
    firstVersion,
    feedback,
    change,
    principles: listOf(principles, (id) => (isText(id) ? id : null)),
  };
}

/** The report, checked field by field, or null when the answer is not one. */
export function parseJournalReport(body: unknown): JournalReport | null {
  if (!isObject(body) || !isText(body['repo'])) return null;
  const generatedAt = timeOf(body['generatedAt']);
  if (generatedAt === null) return null;
  return { generatedAt, repo: body['repo'], entries: listOf(body['entries'], parseEntry) };
}
