import { type RouteTable, json } from '../http/api-handler.ts';
import { fieldsOf } from '../http/body-fields.ts';
import { numberFrom } from '../http/number-from.ts';
import { repoNameFrom } from '../queue/repo-name.ts';
import { type CrewQueue, type CrewRunner, proposeCrew } from './crew-proposal.ts';

export const CREW_PATH = '/api/crew';

const HTTP_CREATED = 201;

async function propose(queue: CrewQueue, runner: CrewRunner, body: unknown): Promise<Response> {
  const fields = fieldsOf(body);
  const repo = repoNameFrom(typeof fields['repo'] === 'string' ? fields['repo'] : null);
  const number = numberFrom(fields['number'], 'a pull request number');
  return json(HTTP_CREATED, await proposeCrew({ queue, runner }, repo, number));
}

/**
 * `table` with the crew routes, which only the local server has, beside its
 * runner (docs/decisions/0005-run-tier-3-tasks-on-the-local-site-only.md):
 *
 *   GET  /api/crew                    { isAvailable }: whether a crew can be sent from here
 *   POST /api/crew { repo, number }   → 201 { prompt, run }: a crew's proposal, for POST /api/runs
 */
export function withCrewRoutes(
  table: RouteTable,
  queue: CrewQueue,
  runner: CrewRunner,
): RouteTable {
  return {
    ...table,
    get: { ...table.get, [CREW_PATH]: async () => ({ isAvailable: runner.isAvailable }) },
    post: { ...table.post, [CREW_PATH]: (body) => propose(queue, runner, body) },
  };
}
