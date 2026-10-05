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

/** One check on the head commit, as the PR screen lists it. */
export interface CheckLine {
  /** The run's own name: `Build`. */
  readonly run: string;
  /** GitHub's own word for it, upper case: `SUCCESS`, `FAILURE`, `IN_PROGRESS`... */
  readonly result: string;
}

export type PullState = 'open' | 'merged' | 'closed';

export type ReviewDecision = 'approved' | 'changes-requested' | 'review-required' | 'none';

const PULL_STATES: readonly PullState[] = ['open', 'merged', 'closed'];
const REVIEW_DECISIONS: readonly ReviewDecision[] = [
  'approved',
  'changes-requested',
  'review-required',
  'none',
];

/** What `GET /api/pull` returns that the PR screen shows. */
export interface PullDetail {
  readonly number: number;
  readonly title: string;
  readonly body: string;
  /** Cut to fit: the rest is on GitHub, so it must not be edited here. */
  readonly bodyTruncated: boolean;
  readonly url: string;
  /** Details from before the API sent a state read as open; the API refuses to merge one that is not. */
  readonly state: PullState;
  readonly isDraft: boolean;
  /** `MERGEABLE`, `CONFLICTING` or `UNKNOWN`. */
  readonly mergeable: string;
  readonly bucket: PullBucket;
  readonly head: string;
  readonly base: string;
  /** The commit a merge is pinned to. */
  readonly headOid: string;
  readonly labels: readonly LabelLine[];
  readonly assignees: readonly string[];
  readonly checks: readonly CheckLine[];
  readonly reviewDecision: ReviewDecision;
  readonly requestedReviewers: readonly string[];
  readonly additions: number;
  readonly deletions: number;
  readonly changedFiles: number;
  readonly files: readonly FileLine[];
  readonly commits: readonly CommitLine[];
  readonly commitsTotal: number;
  readonly diff: string;
  readonly diffBytes: number;
  readonly diffTruncated: boolean;
  /** The preview withholds a private repository's code. */
  readonly diffHidden: boolean;
  readonly fetchedAt: string;
}

type Json = Record<string, unknown>;

/** The pull request itself must be on GitHub. */
const isGitHub = (value: unknown): value is string =>
  isString(value) && value.startsWith('https://github.com/');

function parseCheck(value: unknown): CheckLine | null {
  if (!isObject(value)) return null;
  const run = isString(value['run']) ? value['run'] : value['name'];
  if (!isString(run)) return null;
  return { run, result: isString(value['result']) ? value['result'] : 'PENDING' };
}

const oneOf = <T extends string>(options: readonly T[], value: unknown, fallback: T): T =>
  options.find((option) => option === value) ?? fallback;

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
  const count = (key: string): number => (isCount(value[key]) ? (value[key] as number) : 0);
  const text = (key: string, fallback = ''): string =>
    isString(value[key]) ? (value[key] as string) : fallback;
  return {
    ...core,
    body: text('body'),
    bodyTruncated: value['bodyTruncated'] === true,
    state: oneOf(PULL_STATES, value['state'], 'open'),
    isDraft: value['isDraft'] === true,
    mergeable: text('mergeable', 'UNKNOWN'),
    headOid: text('headOid'),
    labels: listOf(value['labels'], parseLabel),
    assignees: strings(value['assignees']),
    checks: listOf(value['checks'], parseCheck),
    reviewDecision: oneOf(REVIEW_DECISIONS, value['reviewDecision'], 'none'),
    requestedReviewers: strings(value['requestedReviewers']),
    additions: count('additions'),
    deletions: count('deletions'),
    changedFiles: count('changedFiles'),
    files: listOf(value['files'], parseFile),
    commits: listOf(value['commits'], parseCommit),
    commitsTotal: count('commitsTotal'),
    diff: text('diff'),
    diffBytes: count('diffBytes'),
    diffTruncated: value['diffTruncated'] === true,
    diffHidden: value['diffHidden'] === true,
    fetchedAt: text('fetchedAt'),
  };
}
