import { PULL_BUCKETS, PullBucket } from '../projects/projects-report';

export type CheckOutcome = 'passed' | 'failed' | 'pending' | 'skipped';
export type ReviewDecision = 'approved' | 'changes-requested' | 'review-required' | 'none';

export interface CheckLine {
  readonly name: string;
  readonly outcome: CheckOutcome;
  readonly url: string | null;
}

/** What `GET /api/pull` returns: one pull request's details. */
export interface PullDetail {
  readonly number: number;
  readonly title: string;
  readonly body: string;
  readonly url: string;
  readonly isDraft: boolean;
  readonly bucket: PullBucket;
  readonly author: string | null;
  readonly head: string;
  readonly base: string;
  readonly labels: readonly string[];
  readonly closes: readonly number[];
  readonly checks: readonly CheckLine[];
  readonly reviewDecision: ReviewDecision;
  readonly requestedReviewers: readonly string[];
  readonly reviews: readonly { readonly reviewer: string; readonly state: string }[];
  readonly additions: number;
  readonly deletions: number;
  readonly changedFiles: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

type Json = Record<string, unknown>;

const OUTCOMES: readonly CheckOutcome[] = ['passed', 'failed', 'pending', 'skipped'];
const DECISIONS: readonly ReviewDecision[] = [
  'approved',
  'changes-requested',
  'review-required',
  'none',
];

const isObject = (value: unknown): value is Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const isString = (value: unknown): value is string => typeof value === 'string';
const isCount = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0;
const strings = (value: unknown): string[] => (Array.isArray(value) ? value.filter(isString) : []);
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
    outcome: outcome as CheckOutcome,
    url: isHttps(value['url']) ? value['url'] : null,
  };
}

function parseReview(value: unknown): { reviewer: string; state: string } | null {
  if (!isObject(value) || !isString(value['reviewer']) || !isString(value['state'])) return null;
  return { reviewer: value['reviewer'], state: value['state'] };
}

/** Reads the details defensively; anything that does not parse is left out. */
export function parsePullDetail(value: unknown): PullDetail | null {
  if (!isObject(value)) return null;
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
  const decision = value['reviewDecision'];
  const count = (key: string): number => (isCount(value[key]) ? (value[key] as number) : 0);
  return {
    number,
    title,
    body: isString(value['body']) ? value['body'] : '',
    url,
    isDraft: value['isDraft'] === true,
    bucket: bucket as PullBucket,
    author: isString(value['author']) ? value['author'] : null,
    head,
    base,
    labels: strings(value['labels']),
    closes: Array.isArray(value['closes']) ? value['closes'].filter(isCount) : [],
    checks: (Array.isArray(value['checks']) ? value['checks'] : [])
      .map(parseCheck)
      .filter((check): check is CheckLine => check !== null),
    reviewDecision: (DECISIONS as readonly unknown[]).includes(decision)
      ? (decision as ReviewDecision)
      : 'none',
    requestedReviewers: strings(value['requestedReviewers']),
    reviews: (Array.isArray(value['reviews']) ? value['reviews'] : [])
      .map(parseReview)
      .filter((review): review is { reviewer: string; state: string } => review !== null),
    additions: count('additions'),
    deletions: count('deletions'),
    changedFiles: count('changedFiles'),
    createdAt: isString(value['createdAt']) ? value['createdAt'] : '',
    updatedAt: isString(value['updatedAt']) ? value['updatedAt'] : '',
  };
}
