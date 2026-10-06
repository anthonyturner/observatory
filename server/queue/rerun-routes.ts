import type { CheckRerunner } from '../github/check-rerunner.ts';
import type { RouteTable } from '../http/api-handler.ts';
import { pullNumberFrom } from './pull-detail.ts';
import { repoNameFrom } from './repo-name.ts';
import { type RerunSources, rerunFlaky } from './rerun-flaky.ts';

export const RERUN_PATH = '/api/rerun';

const fieldsOf = (body: unknown): Record<string, unknown> =>
  typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {};

/**
 * `table` with the Rerun button's route:
 *
 *   POST /api/rerun { repo, number }  → { number, runs }: the workflow runs started again
 */
export function withRerunRoute(
  table: RouteTable,
  sources: RerunSources,
  rerunner: CheckRerunner,
): RouteTable {
  return {
    ...table,
    post: {
      ...table.post,
      [RERUN_PATH]: (body) => {
        const fields = fieldsOf(body);
        const repo = repoNameFrom(typeof fields['repo'] === 'string' ? fields['repo'] : null);
        return rerunFlaky(sources, rerunner, repo, pullNumberFrom(fields['number']));
      },
    },
  };
}
