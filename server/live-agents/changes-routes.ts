import { BadRequest, type RouteTable } from '../http/api-handler.ts';
import { keyedCache } from '../util/cached-by-key.ts';
import type { ChangesSource } from './agent-changes.ts';
import type { AgentKey } from './live-agent-types.ts';
import { agentKeyFrom } from './live-agents-routes.ts';

export const AGENT_CHANGES_PATH = '/api/live-agents/changes';

/** A diff is many git calls; the tab's Refresh and auto-refresh share one. */
const CHANGES_CACHE_MS = 10_000;
/** The ids name a transcript, and the transcript names the folder. */
const ACCEPTED_KEYS: ReadonlySet<string> = new Set(['session', 'agent']);

/** One cache entry per agent; the ids hold no colon, so the key splits back cleanly. */
const cacheKeyOf = ({ session, agentId }: AgentKey): string => `${session}:${agentId ?? ''}`;

function agentKeyOf(cacheKey: string): AgentKey {
  const [session = '', agentId = ''] = cacheKey.split(':');
  return { session, agentId: agentId || null };
}

function onlyIds(query: URLSearchParams): URLSearchParams {
  for (const key of query.keys()) {
    if (!ACCEPTED_KEYS.has(key)) throw new BadRequest('only session and agent are accepted');
  }
  return query;
}

/**
 * `table` with the agent changes route, which only the local server has: it
 * runs git in folders on this machine.
 *
 *   GET /api/live-agents/changes?session=[&agent=]   that agent's diff, or why there is none
 */
export function withAgentChangesRoutes(table: RouteTable, source: ChangesSource): RouteTable {
  const changes = keyedCache(
    (cacheKey: string) => source.changes(agentKeyOf(cacheKey)),
    CHANGES_CACHE_MS,
  );
  return {
    ...table,
    get: {
      ...table.get,
      [AGENT_CHANGES_PATH]: (query) => changes.read(cacheKeyOf(agentKeyFrom(onlyIds(query)))),
    },
  };
}
