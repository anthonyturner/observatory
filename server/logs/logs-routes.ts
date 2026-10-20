import type { RouteTable } from '../http/api-handler.ts';
import { fieldsOf } from '../http/body-fields.ts';
import { repoNameFrom } from '../queue/repo-name.ts';
import type { LogClears } from './log-clears.ts';
import { localTimeOf } from './log-line.ts';

export const LOGS_CLEAR_PATH = '/api/logs/clear';

/** What a clear changes: the stored time, and the cached snapshot that no longer matches it. */
export interface LogClearSources {
  readonly clears: LogClears;
  /** The next read of this repository's logs goes to the folder, not the cache. */
  forgetLogs(repo: string): void;
  readonly now: () => Date;
}

/** What `POST /api/logs/clear` returns: the log time the sky now ignores everything up to. */
export interface LogClearResult {
  readonly clearedAt: string;
}

/**
 * `table` with the Log Sky's Clear and Reset, which only the local server has: the hosted site
 * shows what a push brought, cleared or not, and nobody there may change it.
 *
 *   POST   /api/logs/clear { repo }   → { clearedAt }: the sky ignores every line up to now
 *   DELETE /api/logs/clear?repo=      → null: every line counts again
 *
 * Neither reads the folder; the page asks for the logs again, which is where the cost lies.
 */
export function withLogClearRoutes(table: RouteTable, sources: LogClearSources): RouteTable {
  return {
    ...table,
    post: {
      ...table.post,
      [LOGS_CLEAR_PATH]: async (body): Promise<LogClearResult> => {
        const fields = fieldsOf(body);
        const repo = repoNameFrom(typeof fields['repo'] === 'string' ? fields['repo'] : null);
        const clearedAt = localTimeOf(sources.now());
        await sources.clears.clear(repo, clearedAt);
        sources.forgetLogs(repo);
        return { clearedAt };
      },
    },
    delete: {
      ...table.delete,
      [LOGS_CLEAR_PATH]: async (query) => {
        const repo = repoNameFrom(query.get('repo'));
        await sources.clears.reset(repo);
        sources.forgetLogs(repo);
        return null;
      },
    },
  };
}
