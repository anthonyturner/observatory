import { type RouteTable } from '../http/api-handler.ts';
import { fieldsOf } from '../http/body-fields.ts';
import { numberFrom } from '../http/number-from.ts';
import { repoNameFrom } from '../queue/repo-name.ts';
import type { DevServerControl, DevTarget } from './dev-server-types.ts';

export const DEV_SERVERS_PATH = '/api/dev-servers';

/** The target a request names: a repository, and optionally one of its pull requests by number. Nothing else of it is used. */
function targetOf(repo: unknown, pull: unknown): DevTarget {
  const name = repoNameFrom(typeof repo === 'string' ? repo : null);
  if (pull === undefined || pull === null) return { repo: name };
  return { repo: name, pull: numberFrom(pull, 'a pull request number') };
}

const fromQuery = (query: URLSearchParams): DevTarget =>
  targetOf(query.get('repo'), query.get('pull'));

/**
 * `table` with the dev-server routes, which only the local server has
 * (docs/decisions/0010-run-a-projects-dev-server-on-the-local-site-only.md).
 * `pull` is optional and names a pull request of the repository, whose head is
 * run in a worktree:
 *
 *   GET    /api/dev-servers?repo=&pull=     the target's dev server: stopped, starting, running with its url, or failed with why
 *   POST   /api/dev-servers { repo, pull }  starts it, or returns the one already running
 *   DELETE /api/dev-servers?repo=&pull=     stops it and everything it started, and removes the worktree
 */
export function withDevServerRoutes(table: RouteTable, servers: DevServerControl): RouteTable {
  return {
    ...table,
    get: {
      ...table.get,
      [DEV_SERVERS_PATH]: async (query) => servers.status(fromQuery(query)),
    },
    post: {
      ...table.post,
      [DEV_SERVERS_PATH]: (body) => {
        const fields = fieldsOf(body);
        return servers.start(targetOf(fields['repo'], fields['pull']));
      },
    },
    delete: {
      ...table.delete,
      [DEV_SERVERS_PATH]: async (query) => servers.stop(fromQuery(query)),
    },
  };
}
