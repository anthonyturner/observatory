import { type RouteTable } from '../http/api-handler.ts';
import { fieldsOf } from '../http/body-fields.ts';
import { repoNameFrom } from '../queue/repo-name.ts';
import type { DevServerControl } from './dev-server-types.ts';

export const DEV_SERVERS_PATH = '/api/dev-servers';

const repoOf = (value: unknown): string => repoNameFrom(typeof value === 'string' ? value : null);

/**
 * `table` with the dev-server routes, which only the local server has
 * (docs/decisions/0010-run-a-projects-dev-server-on-the-local-site-only.md):
 *
 *   GET    /api/dev-servers?repo=     the project's dev server: stopped, starting, running with its url, or failed with why
 *   POST   /api/dev-servers { repo }  starts it, or returns the one already running
 *   DELETE /api/dev-servers?repo=     stops it and everything it started
 */
export function withDevServerRoutes(table: RouteTable, servers: DevServerControl): RouteTable {
  return {
    ...table,
    get: {
      ...table.get,
      [DEV_SERVERS_PATH]: async (query) => servers.status(repoOf(query.get('repo'))),
    },
    post: {
      ...table.post,
      [DEV_SERVERS_PATH]: (body) => servers.start(repoOf(fieldsOf(body)['repo'])),
    },
    delete: {
      ...table.delete,
      [DEV_SERVERS_PATH]: async (query) => servers.stop(repoOf(query.get('repo'))),
    },
  };
}
