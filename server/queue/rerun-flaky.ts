import type { CheckRerunner } from '../github/check-rerunner.ts';
import { Forbidden, NotFound } from '../http/api-handler.ts';
import type { PullDetail } from './pull-detail.ts';
import type { QueueItem, QueueReport } from './queue-report.ts';

/** The part of a pull request's details a rerun reads. */
type PullChecks = Pick<PullDetail, 'checks'>;

/** What a rerun reads and changes, through the API's caches. */
export interface RerunSources {
  queue(repo: string): Promise<QueueReport>;
  pull(repo: string, number: number): Promise<PullChecks>;
  forgetQueue(repo: string): void;
  forgetPull(repo: string, number: number): void;
}

/** What `POST /api/rerun` returns: the workflow runs asked to run their failed jobs again. */
export interface RerunResult {
  readonly number: number;
  readonly runs: readonly number[];
}

/** Failing, and only on checks known to be flaky. */
export const isFlakyOnly = (item: QueueItem): boolean =>
  item.failingChecks > 0 && item.flakyChecks.length === item.failingChecks;

const RUN_ID = /^\/actions\/runs\/(\d+)(?:\/|$)/;

/** The GitHub Actions workflow run a check's page belongs to, or null for any other check. */
export function workflowRunIdOf(repo: string, url: string | null): number | null {
  const prefix = `https://github.com/${repo}`;
  if (!url?.toLowerCase().startsWith(prefix.toLowerCase())) return null;
  const match = RUN_ID.exec(url.slice(prefix.length));
  return match ? Number(match[1]) : null;
}

/** The workflow runs holding `detail`'s failed checks named in `flaky`, each once. */
export function rerunTargets(repo: string, detail: PullChecks, flaky: readonly string[]): number[] {
  const ids = detail.checks
    .filter((check) => check.outcome === 'failed' && flaky.includes(check.run))
    .map((check) => workflowRunIdOf(repo, check.url))
    .filter((id): id is number => id !== null);
  return [...new Set(ids)];
}

/**
 * Reruns the failed jobs of a pull request that fails only on flaky checks.
 * Any other pull request is refused: rerunning a real failure spends CI time
 * and hides nothing.
 */
export async function rerunFlaky(
  sources: RerunSources,
  rerunner: CheckRerunner,
  repo: string,
  number: number,
): Promise<RerunResult> {
  const item = (await sources.queue(repo)).items.find((each) => each.number === number);
  if (!item) throw new NotFound(`#${number} is not an open pull request in ${repo}`);
  if (!isFlakyOnly(item)) throw new Forbidden(`#${number} is not failing only on flaky checks`);
  // Read afresh: a minute-old copy may name runs already started again.
  sources.forgetPull(repo, number);
  const runs = rerunTargets(repo, await sources.pull(repo, number), item.flakyChecks);
  if (!runs.length) {
    throw new Forbidden(`#${number}'s flaky checks are not GitHub Actions runs to rerun`);
  }
  try {
    for (const runId of runs) await rerunOne(rerunner, repo, runId);
  } finally {
    // Even a partial rerun changed GitHub, so neither cached copy holds.
    sources.forgetQueue(repo);
    sources.forgetPull(repo, number);
  }
  return { number, runs };
}

/** Reruns one workflow run's failed jobs, or a Forbidden in words a person can act on. */
export async function rerunOne(
  rerunner: CheckRerunner,
  repo: string,
  runId: number,
): Promise<void> {
  try {
    await rerunner.rerunFailedJobs(repo, runId);
  } catch (error: unknown) {
    console.error(`GitHub would not rerun ${repo}'s workflow run ${runId}:`, error);
    throw new Forbidden(
      `GitHub would not rerun workflow run ${runId}: it may still be running, or be too old to rerun`,
    );
  }
}
