import type { RawCheck, RawCommit, RawFile, RawLabel, RawPull } from '../github/pull-reader.ts';
import { BadRequest } from '../http/api-handler.ts';
import { type PullBucket, bucketOf } from '../projects/pull-counts.ts';
import { clipBody, fitDiff } from './pull-size.ts';

export type CheckOutcome = 'passed' | 'failed' | 'pending' | 'skipped';

/** One check on the pull request's head commit. */
export interface CheckLine {
  /** As specific as GitHub gives it: `CI / Build`. */
  readonly name: string;
  /** The run's own name, as pr-starmap's PR screen lists it: `Build`. */
  readonly run: string;
  readonly outcome: CheckOutcome;
  /** GitHub's own word for it, upper case: `SUCCESS`, `FAILURE`, `IN_PROGRESS`... */
  readonly result: string;
  /** Where to read it on GitHub, when it has a page. */
  readonly url: string | null;
}

export type ReviewDecision = 'approved' | 'changes-requested' | 'review-required' | 'none';

export interface FileLine {
  readonly path: string;
  readonly additions: number;
  readonly deletions: number;
  /** `ADDED`, `MODIFIED`, `DELETED`, `RENAMED`... */
  readonly change: string;
}

export interface CommitLine {
  /** The first seven characters of its hash. */
  readonly oid: string;
  readonly headline: string;
  readonly date: string;
  readonly authors: readonly string[];
}

/** What the PR screen shows about one pull request. */
export interface PullDetail {
  readonly number: number;
  readonly title: string;
  readonly body: string;
  /** The description was cut to fit; the rest is on GitHub, and it must not be sent back. */
  readonly bodyTruncated: boolean;
  readonly url: string;
  readonly isDraft: boolean;
  /** `MERGEABLE`, `CONFLICTING` or `UNKNOWN`. */
  readonly mergeable: string;
  readonly bucket: PullBucket;
  readonly author: string | null;
  readonly head: string;
  readonly base: string;
  /** What a merge is pinned to: anything pushed after it was seen makes the merge refuse. */
  readonly headOid: string;
  readonly labels: readonly RawLabel[];
  readonly assignees: readonly string[];
  readonly closes: readonly number[];
  readonly checks: readonly CheckLine[];
  readonly reviewDecision: ReviewDecision;
  readonly requestedReviewers: readonly string[];
  /** Each reviewer's latest review: `approved`, `changes requested`, `commented`... */
  readonly reviews: readonly { readonly reviewer: string; readonly state: string }[];
  readonly additions: number;
  readonly deletions: number;
  readonly changedFiles: number;
  readonly files: readonly FileLine[];
  /** The latest COMMIT_LIMIT commits, oldest first. */
  readonly commits: readonly CommitLine[];
  readonly commitsTotal: number;
  /** The unified diff, empty when GitHub would not produce it. */
  readonly diff: string;
  /** How long the diff was before it was cut to fit. */
  readonly diffBytes: number;
  readonly diffTruncated: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly fetchedAt: string;
}

/** What was read alongside the pull request itself. */
export interface PullExtras {
  readonly diff: string;
  readonly fetchedAt: string;
}

const COMMIT_LIMIT = 50;
const SHORT_OID_LENGTH = 7;

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

/** As pr-starmap names a check, and words its result: the conclusion, else the state, else how far it has run. */
const runOf = (check: RawCheck): string => check.name ?? check.context ?? 'check';
const resultOf = (check: RawCheck): string =>
  (check.conclusion || check.state || check.status || 'PENDING').toUpperCase();

/** Every check, in the order GitHub lists them. */
export function checkLinesOf(checks: readonly RawCheck[] | null): CheckLine[] {
  return (checks ?? []).map((check) => ({
    name: nameOf(check),
    run: runOf(check),
    outcome: outcomeOf(check),
    result: resultOf(check),
    url: check.detailsUrl || check.targetUrl || null,
  }));
}

const DECISIONS: Readonly<Record<string, ReviewDecision>> = {
  APPROVED: 'approved',
  CHANGES_REQUESTED: 'changes-requested',
  REVIEW_REQUIRED: 'review-required',
};

const reviewStateOf = (state: string): string => state.toLowerCase().replace(/_/g, ' ');

const fileLineOf = (file: RawFile): FileLine => ({
  path: file.path,
  additions: file.additions,
  deletions: file.deletions,
  change: file.changeType,
});

const commitLineOf = (commit: RawCommit): CommitLine => ({
  oid: commit.oid.slice(0, SHORT_OID_LENGTH),
  headline: commit.messageHeadline,
  date: commit.committedDate ?? commit.authoredDate,
  authors: (commit.authors ?? []).map((author) => author.login || author.name).filter(Boolean),
});

function reviewOf(
  raw: RawPull,
): Pick<PullDetail, 'reviewDecision' | 'requestedReviewers' | 'reviews'> {
  return {
    reviewDecision: DECISIONS[raw.reviewDecision] ?? 'none',
    requestedReviewers: (raw.reviewRequests ?? [])
      .map((request) => request.login ?? request.name ?? '')
      .filter(Boolean),
    reviews: (raw.latestReviews ?? []).map((review) => ({
      reviewer: review.author?.login ?? 'someone',
      state: reviewStateOf(review.state),
    })),
  };
}

/** Everything the screen shows, with the diff cut until the whole fits. */
export function pullDetailOf(raw: RawPull, extras: PullExtras): PullDetail {
  const commits = raw.commits ?? [];
  return fitDiff({
    number: raw.number,
    title: raw.title,
    ...clipBody(raw.body),
    url: raw.url,
    isDraft: raw.isDraft,
    mergeable: raw.mergeable,
    bucket: bucketOf(raw),
    author: raw.author?.login ?? null,
    head: raw.headRefName,
    base: raw.baseRefName,
    headOid: raw.headRefOid,
    labels: (raw.labels ?? []).map((label) => ({ name: label.name, color: label.color })),
    assignees: (raw.assignees ?? []).map((person) => person.login),
    closes: (raw.closingIssuesReferences ?? []).map((issue) => issue.number),
    checks: checkLinesOf(raw.statusCheckRollup),
    ...reviewOf(raw),
    additions: raw.additions,
    deletions: raw.deletions,
    changedFiles: raw.changedFiles,
    files: (raw.files ?? []).map(fileLineOf),
    commits: commits.slice(-COMMIT_LIMIT).map(commitLineOf),
    commitsTotal: commits.length,
    diff: extras.diff,
    diffBytes: extras.diff.length,
    diffTruncated: false,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
    fetchedAt: extras.fetchedAt,
  });
}

/** A pull request number from a request, or a BadRequest. */
export function pullNumberFrom(value: unknown): number {
  const text = typeof value === 'number' ? String(value) : value;
  const number = Number(text);
  if (typeof text !== 'string' || !/^\d{1,9}$/.test(text) || number < 1) {
    throw new BadRequest('number must be a pull request number');
  }
  return number;
}
