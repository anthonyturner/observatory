import type { RawCheck, RawPull } from '../github/pull-reader.ts';
import { BadRequest } from '../http/api-handler.ts';
import { type PullBucket, bucketOf } from '../projects/pull-counts.ts';

export type CheckOutcome = 'passed' | 'failed' | 'pending' | 'skipped';

/** One check on the pull request's head commit. */
export interface CheckLine {
  readonly name: string;
  readonly outcome: CheckOutcome;
  /** Where to read it on GitHub, when it has a page. */
  readonly url: string | null;
}

export type ReviewDecision = 'approved' | 'changes-requested' | 'review-required' | 'none';

/** What the PR screen shows about one pull request. */
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
  /** Each reviewer's latest review: `approved`, `changes requested`, `commented`... */
  readonly reviews: readonly { readonly reviewer: string; readonly state: string }[];
  readonly additions: number;
  readonly deletions: number;
  readonly changedFiles: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

const FAILED = new Set([
  'FAILURE',
  'ERROR',
  'TIMED_OUT',
  'CANCELLED',
  'ACTION_REQUIRED',
  'STARTUP_FAILURE',
]);
const SKIPPED = new Set(['SKIPPED', 'NEUTRAL', 'STALE']);
/** A check's name, as specific as GitHub gives it. */
const nameOf = (check: RawCheck): string =>
  [check.workflowName, check.name ?? check.context].filter(Boolean).join(' / ') || 'unnamed check';

export function outcomeOf(check: RawCheck): CheckOutcome {
  const verdict = check.conclusion || check.state || '';
  if (FAILED.has(verdict)) return 'failed';
  if (SKIPPED.has(verdict)) return 'skipped';
  if (verdict === 'SUCCESS') return 'passed';
  return 'pending';
}

const OUTCOME_ORDER: readonly CheckOutcome[] = ['failed', 'pending', 'passed', 'skipped'];

/** Every check, failed first, then pending, then the ones that passed. */
export function checkLinesOf(checks: readonly RawCheck[] | null): CheckLine[] {
  return (checks ?? [])
    .map((check) => ({
      name: nameOf(check),
      outcome: outcomeOf(check),
      url: check.detailsUrl || check.targetUrl || null,
    }))
    .sort((a, b) => OUTCOME_ORDER.indexOf(a.outcome) - OUTCOME_ORDER.indexOf(b.outcome));
}

const DECISIONS: Readonly<Record<string, ReviewDecision>> = {
  APPROVED: 'approved',
  CHANGES_REQUESTED: 'changes-requested',
  REVIEW_REQUIRED: 'review-required',
};

const reviewStateOf = (state: string): string => state.toLowerCase().replace(/_/g, ' ');

export function pullDetailOf(raw: RawPull): PullDetail {
  return {
    number: raw.number,
    title: raw.title,
    body: raw.body ?? '',
    url: raw.url,
    isDraft: raw.isDraft,
    bucket: bucketOf(raw),
    author: raw.author?.login ?? null,
    head: raw.headRefName,
    base: raw.baseRefName,
    labels: (raw.labels ?? []).map((label) => label.name),
    closes: (raw.closingIssuesReferences ?? []).map((issue) => issue.number),
    checks: checkLinesOf(raw.statusCheckRollup),
    reviewDecision: DECISIONS[raw.reviewDecision] ?? 'none',
    requestedReviewers: (raw.reviewRequests ?? [])
      .map((request) => request.login ?? request.name ?? '')
      .filter(Boolean),
    reviews: (raw.latestReviews ?? []).map((review) => ({
      reviewer: review.author?.login ?? 'someone',
      state: reviewStateOf(review.state),
    })),
    additions: raw.additions,
    deletions: raw.deletions,
    changedFiles: raw.changedFiles,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
}

/** A pull request number from a request, or a BadRequest. */
export function pullNumberFrom(value: string | null): number {
  const number = Number(value);
  if (!value || !/^\d{1,9}$/.test(value) || number < 1) {
    throw new BadRequest('number must be a pull request number');
  }
  return number;
}
