import type { RouteTable } from '../http/api-handler.ts';
import { repoNameFrom } from '../queue/repo-name.ts';
import type { DepthReports } from './depth-report.ts';

export const DEPTH_PATH = '/api/depth';

/** `table` with a repository's modules and their depth. Only the local API adds it: it reads a clone on this machine. */
export function withDepthRoutes(table: RouteTable, depth: DepthReports): RouteTable {
  return {
    ...table,
    get: {
      ...table.get,
      [DEPTH_PATH]: (query) => {
        const repo = repoNameFrom(query.get('repo'));
        if (query.get('fresh') === '1') depth.forget(repo);
        return depth.read(repo);
      },
    },
  };
}
