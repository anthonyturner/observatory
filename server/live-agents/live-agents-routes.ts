import { BadRequest, type RouteTable } from '../http/api-handler.ts';
import { cached } from '../util/cached.ts';
import type { AgentKey, LiveAgentAnswer, LiveAgentsReport } from './live-agent-types.ts';

export const LIVE_AGENTS_PATH = '/api/live-agents';

/** Every page with a badge asks; one read of the transcripts serves them all. */
const LIVE_AGENTS_CACHE_MS = 5_000;

const SESSION_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const AGENT_ID = /^[0-9a-f]{1,64}$/i;

/** Reads the live list and one agent; the routes know nothing of where from. */
export interface LiveAgentsSource {
  list(): Promise<LiveAgentsReport>;
  one(key: AgentKey): Promise<LiveAgentAnswer>;
}

/** The ids a request names, or a BadRequest: only ids reach the file system, never a path. */
export function agentKeyFrom(query: URLSearchParams): AgentKey {
  const session = query.get('session') ?? '';
  const agentId = query.get('agent');
  if (!SESSION_ID.test(session)) throw new BadRequest('session must be a session id');
  if (agentId !== null && !AGENT_ID.test(agentId)) {
    throw new BadRequest('agent must be a subagent id');
  }
  return { session: session.toLowerCase(), agentId: agentId?.toLowerCase() ?? null };
}

/**
 * `table` with the live agents routes, which only the local server has: they
 * read the transcripts in this machine's home folder.
 *
 *   GET /api/live-agents                       the agents running now
 *   GET /api/live-agents?session=[&agent=]     that one, running or not: { agent } or { agent: null }
 */
export function withLiveAgentsRoutes(table: RouteTable, source: LiveAgentsSource): RouteTable {
  const list = cached(() => source.list(), LIVE_AGENTS_CACHE_MS);
  return {
    ...table,
    get: {
      ...table.get,
      [LIVE_AGENTS_PATH]: (query) =>
        query.has('session') || query.has('agent') ? source.one(agentKeyFrom(query)) : list(),
    },
  };
}
