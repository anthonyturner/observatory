import { NotFound, json, type RouteTable } from '../http/api-handler.ts';
import { ndjsonResponse } from '../http/ndjson-response.ts';
import { type RunControl, RunnerBusy } from './runner.ts';
import { startRequestFrom } from './start-request.ts';

export const RUNS_PATH = '/api/runs';

const HTTP_CREATED = 201;
const HTTP_CONFLICT = 409;

const idOf = (query: URLSearchParams): string => query.get('id') ?? '';

/** Where a follower starts: a whole number of events, 0 when not given or not one. */
const fromOf = (query: URLSearchParams): number =>
  Math.max(0, Number.parseInt(query.get('from') ?? '0', 10) || 0);

/** The run list, or with `?id=` that run's events from `?from=` on, then live. */
async function listOrFollow(runs: RunControl, query: URLSearchParams): Promise<unknown> {
  const id = query.get('id');
  if (!id) return runs.report();
  if (!runs.has(id)) throw new NotFound('no such run');
  return ndjsonResponse((sink) => runs.follow(id, fromOf(query), sink));
}

async function start(runs: RunControl, body: unknown): Promise<Response> {
  try {
    return json(HTTP_CREATED, await runs.start(startRequestFrom(body)));
  } catch (error) {
    if (!(error instanceof RunnerBusy)) throw error;
    return json(HTTP_CONFLICT, { error: error.message, run: error.runId });
  }
}

/**
 * `table` with the runs routes, which only the local server has:
 *
 *   GET    /api/runs              the current run and the last few
 *   GET    /api/runs?id=&from=    run `id`'s events from number `from`, then live, as NDJSON
 *   POST   /api/runs              { token, prompt, folder } → 201 and the run started
 *   DELETE /api/runs?id=          cancel it
 */
export function withRunsRoutes(table: RouteTable, runs: RunControl): RouteTable {
  return {
    ...table,
    get: { ...table.get, [RUNS_PATH]: (query) => listOrFollow(runs, query) },
    post: { ...table.post, [RUNS_PATH]: (body) => start(runs, body) },
    delete: { ...table.delete, [RUNS_PATH]: async (query) => runs.cancel(idOf(query)) },
  };
}
