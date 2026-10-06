/** One finished attempt of a check at one commit. */
export interface CheckAttempt {
  readonly name: string;
  readonly sha: string;
  /** GitHub's word for how it ended, upper case: `SUCCESS`, `FAILURE`... */
  readonly conclusion: string;
  readonly completedAt: string;
}

/** What the flaky-check detector needs from GitHub, and nothing else. */
export interface CheckHistoryReader {
  /** Every attempt of each recent workflow run that was run more than once. */
  checkHistory(repo: string): Promise<CheckAttempt[]>;
}

/** Reads one GitHub REST path, from below the API's root, as JSON. */
export type JsonGet = (path: string) => Promise<unknown>;

/** The most recent workflow runs looked through, across every branch and pull request. */
const RUN_LIMIT = 100;
/** Each rerun costs one more request, so only the latest few are read. */
const RERUN_LIMIT = 20;
const JOB_LIMIT = 100;

type Json = Readonly<Record<string, unknown>>;

const isJson = (value: unknown): value is Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const isText = (value: unknown): value is string => typeof value === 'string' && value !== '';
const listIn = (body: unknown, key: string): Json[] => {
  const list = isJson(body) ? body[key] : null;
  return Array.isArray(list) ? list.filter(isJson) : [];
};

/** The ids of the workflow runs in a `GET /actions/runs` answer that were run again. */
export function rerunIdsOf(body: unknown): number[] {
  return listIn(body, 'workflow_runs')
    .filter((run) => typeof run['run_attempt'] === 'number' && run['run_attempt'] > 1)
    .map((run) => run['id'])
    .filter((id): id is number => Number.isInteger(id));
}

/** The finished jobs, from every attempt, in a `GET /actions/runs/{id}/jobs?filter=all` answer. */
export function attemptsOf(body: unknown): CheckAttempt[] {
  return listIn(body, 'jobs').flatMap((job) => {
    const { name, head_sha: sha, conclusion, completed_at: completedAt } = job;
    if (!isText(name) || !isText(sha) || !isText(conclusion) || !isText(completedAt)) return [];
    return [{ name, sha, conclusion: conclusion.toUpperCase(), completedAt }];
  });
}

/**
 * The attempts of a repository's recently rerun GitHub Actions runs. A rerun
 * keeps the run's id and head commit, and `filter=all` lists the jobs of
 * every attempt, so a job that failed and then passed shows as both.
 */
export async function readCheckHistory(get: JsonGet, repo: string): Promise<CheckAttempt[]> {
  const reruns = rerunIdsOf(await get(`repos/${repo}/actions/runs?per_page=${RUN_LIMIT}`));
  const answers = await Promise.all(
    reruns
      .slice(0, RERUN_LIMIT)
      .map((id) => get(`repos/${repo}/actions/runs/${id}/jobs?filter=all&per_page=${JOB_LIMIT}`)),
  );
  return answers.flatMap(attemptsOf);
}
