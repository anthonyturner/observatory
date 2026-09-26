import type { PullRequest } from '../github/github-reader.ts';
import type { ProjectCounts } from './project-types.ts';

export type PullBucket = 'conflicted' | 'failing' | 'unknown' | 'unlinked' | 'unreviewed';

/** Most urgent first; the index is the sort key. */
export const BUCKET_ORDER: readonly PullBucket[] = [
  'conflicted',
  'failing',
  'unknown',
  'unlinked',
  'unreviewed',
];

export const bucketRank = (bucket: PullBucket): number => BUCKET_ORDER.indexOf(bucket);

const DAY_MS = 86_400_000;
const FAILED_VERDICTS = new Set(['FAILURE', 'ERROR', 'TIMED_OUT']);

export function failingChecks(pull: PullRequest): number {
  return (pull.statusCheckRollup ?? []).filter((run) =>
    FAILED_VERDICTS.has(run.conclusion ?? run.state ?? ''),
  ).length;
}

/** The most urgent thing about a pull request, blocked first. */
export function bucketOf(pull: PullRequest): PullBucket {
  if (pull.mergeable === 'CONFLICTING') return 'conflicted';
  if (failingChecks(pull) > 0) return 'failing';
  // Still unsettled after the retries: an unanswered question is not a clean
  // bill of health.
  if (pull.mergeable === 'UNKNOWN') return 'unknown';
  // Without `Closes #n` the merge closes nothing and the issue stays open.
  if (!pull.closingIssuesReferences?.length) return 'unlinked';
  return 'unreviewed';
}

/** Open issues that no open pull request says it closes. */
export function unclaimedIssues(
  pulls: readonly PullRequest[],
  openIssues: readonly number[],
): number {
  const claimed = new Set(
    pulls.flatMap((pull) => (pull.closingIssuesReferences ?? []).map((ref) => ref.number)),
  );
  return openIssues.filter((issue) => !claimed.has(issue)).length;
}

export function pullCounts(
  pulls: readonly PullRequest[],
  openIssues: readonly number[] | null,
): ProjectCounts {
  const buckets = pulls.map(bucketOf);
  const count = (bucket: PullBucket): number => buckets.filter((each) => each === bucket).length;
  return {
    conflicted: count('conflicted'),
    failing: count('failing'),
    unknown: count('unknown'),
    unlinked: count('unlinked'),
    unreviewed: count('unreviewed'),
    unclaimed: openIssues ? unclaimedIssues(pulls, openIssues) : 0,
  };
}

/** Whole days since the least recently touched pull request changed. */
export function oldestIdleDays(pulls: readonly PullRequest[], now: number): number {
  return pulls.reduce(
    (oldest, pull) => Math.max(oldest, Math.floor((now - Date.parse(pull.updatedAt)) / DAY_MS)),
    0,
  );
}
