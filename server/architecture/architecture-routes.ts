import type { RouteTable } from '../http/api-handler.ts';
import { repoNameFrom } from '../queue/repo-name.ts';
import { architectureHtml } from './architecture-html.ts';
import type { ArchitectureMaps } from './architecture-maps.ts';
import type { ArchitectureMap } from './architecture-types.ts';

export const ARCHITECTURE_PATH = '/api/architecture';
export const ARCHITECTURE_HTML_PATH = '/api/architecture/html';

/**
 * `table` with a repository's architecture map, as JSON and as the one-file
 * viewer page:
 *
 *   GET /api/architecture?repo=owner/name[&fresh=1]   the map; `fresh` scans again
 *   GET /api/architecture/html?repo=owner/name        the viewer page, to open in a tab
 *
 * Only the local API adds these: a map names every class of a clone that may be private.
 */
export function withArchitectureRoutes(
  table: RouteTable,
  maps: ArchitectureMaps,
  render: (map: ArchitectureMap) => Promise<string> = architectureHtml,
): RouteTable {
  return {
    ...table,
    get: {
      ...table.get,
      [ARCHITECTURE_PATH]: (query) => {
        const repo = repoNameFrom(query.get('repo'));
        if (query.get('fresh') === '1') maps.forget(repo);
        return maps.read(repo);
      },
      [ARCHITECTURE_HTML_PATH]: async (query) =>
        new Response(await render(await maps.read(repoNameFrom(query.get('repo')))), {
          headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
        }),
    },
  };
}
