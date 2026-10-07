import type { CheckRerunner } from '../github/check-rerunner.ts';
import { Forbidden, NotFound, type RouteTable } from '../http/api-handler.ts';
import { fieldsOf } from '../http/body-fields.ts';
import { numberFrom } from '../http/number-from.ts';
import { repoNameFrom } from '../queue/repo-name.ts';
import { rerunOne } from '../queue/rerun-flaky.ts';
import type { ActionsReport } from './actions-types.ts';

export const ACTIONS_RERUN_PATH = '/api/actions/rerun';

/** What a rerun reads and changes, through the API's caches. */
export interface ActionsRerunSources {
  actions(repo: string): Promise<ActionsReport>;
  forgetActions(repo: string): void;
}

/** What `POST /api/actions/rerun` returns: the run asked to run its failed jobs again. */
export interface ActionsRerunResult {
  readonly run: number;
}

/** Workflow run ids are past ten billion already; fifteen digits stays a safe integer. */
const RUN_ID_DIGITS = 15;

export const runIdFrom = (value: unknown): number =>
  numberFrom(value, 'a workflow run id', RUN_ID_DIGITS);

/** Reruns the failed jobs of one of the repository's recent runs that failed; any other is refused. */
export async function rerunFailedRun(
  sources: ActionsRerunSources,
  rerunner: CheckRerunner,
  repo: string,
  runId: number,
): Promise<ActionsRerunResult> {
  const run = (await sources.actions(repo)).runs.find((each) => each.id === runId);
  if (!run) throw new NotFound(`run ${runId} is not a recent workflow run of ${repo}`);
  if (run.outcome !== 'failed') throw new Forbidden(`run ${runId} has no failed jobs to rerun`);
  try {
    await rerunOne(rerunner, repo, runId);
  } finally {
    // Even a refused rerun may mean the cached copy is out of date.
    sources.forgetActions(repo);
  }
  return { run: runId };
}

/**
 * `table` with the Actions screen's rerun:
 *
 *   POST /api/actions/rerun { repo, run }  → { run }: the run started again
 */
export function withActionsRerunRoute(
  table: RouteTable,
  sources: ActionsRerunSources,
  rerunner: CheckRerunner,
): RouteTable {
  return {
    ...table,
    post: {
      ...table.post,
      [ACTIONS_RERUN_PATH]: (body) => {
        const fields = fieldsOf(body);
        const repo = repoNameFrom(typeof fields['repo'] === 'string' ? fields['repo'] : null);
        return rerunFailedRun(sources, rerunner, repo, runIdFrom(fields['run']));
      },
    },
  };
}
