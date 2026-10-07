import { BadRequest, type RouteTable } from '../http/api-handler.ts';
import type { AgentFeedPage } from './feed-types.ts';
import type { AgentKey } from './live-agent-types.ts';
import { agentKeyFrom } from './live-agents-routes.ts';

export const LIVE_AGENT_FEED_PATH = '/api/live-agents/feed';

/** A byte offset: digits only, and few enough to stay an exact number. */
const BYTE_OFFSET = /^\d{1,15}$/;

/** Reads one agent's feed; the route knows nothing of where from. */
export interface AgentFeedSource {
  feed(key: AgentKey, from: number | null): Promise<AgentFeedPage>;
}

/** The cursor a request carries, null for a first load, or a BadRequest. */
export function cursorFrom(query: URLSearchParams): number | null {
  const from = query.get('from');
  if (from === null) return null;
  if (!BYTE_OFFSET.test(from)) throw new BadRequest('from must be a byte offset');
  return Number(from);
}

/**
 * `table` with the live agent feed, which only the local server has: it reads
 * the transcripts in this machine's home folder. Not cached, since every open
 * tab asks from a cursor of its own.
 *
 *   GET /api/live-agents/feed?session=[&agent=][&from=]   { events, next, isRestart }
 */
export function withLiveAgentFeedRoute(table: RouteTable, source: AgentFeedSource): RouteTable {
  return {
    ...table,
    get: {
      ...table.get,
      [LIVE_AGENT_FEED_PATH]: (query) => source.feed(agentKeyFrom(query), cursorFrom(query)),
    },
  };
}
