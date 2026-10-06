import type { CheckAttempt } from '../github/check-history.ts';
import type { PullRequest } from '../github/github-reader.ts';
import { failingCheckNames } from '../projects/pull-counts.ts';

const FAILED = new Set(['FAILURE', 'TIMED_OUT']);
const PASSED = 'SUCCESS';

const runKey = (attempt: CheckAttempt): string => `${attempt.sha} ${attempt.name}`;

function attemptsByRun(attempts: readonly CheckAttempt[]): CheckAttempt[][] {
  const runs = new Map<string, CheckAttempt[]>();
  for (const attempt of attempts) {
    const key = runKey(attempt);
    runs.set(key, [...(runs.get(key) ?? []), attempt]);
  }
  return [...runs.values()];
}

/** Whether one check, at one commit, failed and then passed when run again. */
function failedThenPassed(attempts: readonly CheckAttempt[]): boolean {
  const inOrder = [...attempts].sort((a, b) => a.completedAt.localeCompare(b.completedAt));
  const firstFailure = inOrder.findIndex((attempt) => FAILED.has(attempt.conclusion));
  return firstFailure >= 0 && inOrder.slice(firstFailure + 1).some((a) => a.conclusion === PASSED);
}

/**
 * The checks that are flaky: on some commit, on any branch or pull request,
 * one failed and then passed on a rerun. Nothing changed between the two, so
 * the failure said nothing about the code.
 */
export function flakyCheckNames(attempts: readonly CheckAttempt[]): ReadonlySet<string> {
  return new Set(
    attemptsByRun(attempts)
      .filter(failedThenPassed)
      .map((run) => run[0].name),
  );
}

/** The failing checks on `pull` that are known to be flaky, one per failing run. */
export const flakyFailures = (pull: PullRequest, flaky: ReadonlySet<string>): string[] =>
  failingCheckNames(pull).filter((name) => flaky.has(name));
