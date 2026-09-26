import { PULL_BUCKETS, PullBucket } from '../projects/projects-report';
import {
  CommitLine,
  FileLine,
  LabelLine,
  isCount,
  isObject,
  isString,
  listOf,
  parseCommit,
  parseFile,
  parseLabel,
  strings,
} from './pull-detail-parts';

export type { CommitLine, FileLine, LabelLine } from './pull-detail-parts';

export type CheckOutcome = 'passed' | 'failed' | 'pending' | 'skipped';
export type ReviewDecision = 'approved' | 'changes-requested' | 'review-required' | 'none';

export interface CheckLine {
  /** As specific as GitHub gives it: `CI / Build`. */
  readonly name: string;
  /** The run's own name, as pr-starmap's PR screen lists it: `Build`. */
  readonly run: string;
  readonly outcome: CheckOutcome;
  /** GitHub's own word for it, upper case: `SUCCESS`, `FAILURE`, `IN_PROGRESS`... */
  readonly result: string;
  readonly url: string | null;
}

/** What `GET /api/pull` returns: one pull request's details. */
export interface PullDetail {
  readonly number: number;
  readonly title: string;
  readonly body: string;
  /** Cut to fit: the rest is on GitHub, so it must not be edited here. */
  readonly bodyTruncated: boolean;
  readonly url: string;
  readonly isDraft: boolean;
  /** `MERGEABLE`, `CONFLICTING` or `UNKNOWN`. */
  readonly mergeable: string;
  readonly bucket: PullBucket;
  readonly author: string | null;
  readonly head: string;
  readonly base: string;
  /** The commit a merge is pinned to. */
  readonly headOid: string;
  readonly labels: readonly LabelLine[];
  readonly assignees: readonly string[];
  readonly closes: readonly number[];
  readonly checks: readonly CheckLine[];
  readonly reviewDecision: ReviewDecision;
  readonly requestedReviewers: readonly string[];
  readonly reviews: readonly { readonly reviewer: string; readonly state: string }[];
  readonly additions: number;
  readonly deletions: number;
  readonly changedFiles: number;
  readonly files: readonly FileLine[];
  readonly commits: readonly CommitLine[];
  readonly commitsTotal: number;
  readonly diff: string;
  readonly diffBytes: number;
  readonly diffTruncated: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly fetchedAt: string;
}

type Json = Record<string, unknown>;

const OUTCOMES: readonly CheckOutcome[] = ['passed', 'failed', 'pending', 'skipped'];
const DECISIONS: readonly ReviewDecision[] = [
  'approved',
  'changes-requested',
  'review-required',
  'none',
];

/** Only links out over https are followed; the pull request itself must be on GitHub. */
const isHttps = (value: unknown): value is string =>
  isString(value) && value.startsWith('https://');
const isGitHub = (value: unknown): value is string =>
  isString(value) && value.startsWith('https://github.com/');

function parseCheck(value: unknown): CheckLine | null {
  if (!isObject(value) || !isString(value['name'])) return null;
  const outcome = value['outcome'];
  if (!(OUTCOMES as readonly unknown[]).includes(outcome)) return null;
  return {
    name: value['name'],
    run: isString(value['run']) ? value['run'] : value['name'],
    outcome: outcome as CheckOutcome,
    result: isString(value['result']) ? value['result'] : 'PENDING',
    url: isHttps(value['url']) ? value['url'] : null,
  };
}

function parseReview(value: unknown): { reviewer: string; state: string } | null {
  if (!isObject(value) || !isString(value['reviewer']) || !isString(value['state'])) return null;
  return { reviewer: value['reviewer'], state: value['state'] };
}

/** The fields a detail cannot be shown without, or null. */
function coreOf(
  value: Json,
): Pick<PullDetail, 'number' | 'title' | 'url' | 'head' | 'base' | 'bucket'> | null {
  const { number, title, url, bucket, head, base } = value;
  if (
    !isCount(number) ||
    !isString(title) ||
    !isGitHub(url) ||
    !isString(head) ||
    !isString(base)
  ) {
    return null;
  }
  if (!(PULL_BUCKETS as readonly unknown[]).includes(bucket)) return null;
  return { number, title, url, head, base, bucket: bucket as PullBucket };
}

/** Reads the details defensively; anything that does not parse is left out. */
export function parsePullDetail(value: unknown): PullDetail | null {
  if (!isObject(value)) return null;
  const core = coreOf(value);
  if (!core) return null;
  const decision = value['reviewDecision'];
  const count = (key: string): number => (isCount(value[key]) ? (value[key] as number) : 0);
  const text = (key: string, fallback = ''): string =>
    isString(value[key]) ? (value[key] as string) : fallback;
  return {
    ...core,
    body: text('body'),
    bodyTruncated: value['bodyTruncated'] === true,
    isDraft: value['isDraft'] === true,
    mergeable: text('mergeable', 'UNKNOWN'),
    author: isString(value['author']) ? value['author'] : null,
    headOid: text('headOid'),
    labels: listOf(value['labels'], parseLabel),
    assignees: strings(value['assignees']),
    closes: Array.isArray(value['closes']) ? value['closes'].filter(isCount) : [],
    checks: listOf(value['checks'], parseCheck),
    reviewDecision: (DECISIONS as readonly unknown[]).includes(decision)
      ? (decision as ReviewDecision)
      : 'none',
    requestedReviewers: strings(value['requestedReviewers']),
    reviews: listOf(value['reviews'], parseReview),
    additions: count('additions'),
    deletions: count('deletions'),
    changedFiles: count('changedFiles'),
    files: listOf(value['files'], parseFile),
    commits: listOf(value['commits'], parseCommit),
    commitsTotal: count('commitsTotal'),
    diff: text('diff'),
    diffBytes: count('diffBytes'),
    diffTruncated: value['diffTruncated'] === true,
    createdAt: text('createdAt'),
    updatedAt: text('updatedAt'),
    fetchedAt: text('fetchedAt'),
  };
}
