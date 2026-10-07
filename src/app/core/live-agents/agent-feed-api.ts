import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { InjectionToken, inject } from '@angular/core';
import { Observable, catchError, map, of } from 'rxjs';
import { parseAgentFeed } from './agent-feed-parse';
import { AgentFeedRead } from './agent-feed.types';
import { LiveAgentKey } from './live-agents.types';

/** Reads one agent's feed from a byte cursor, each read as a state that never errors. */
export interface AgentFeedApi {
  /** `from` null asks for a first load: the agent's latest events. */
  feed(key: LiveAgentKey, from: number | null): Observable<AgentFeedRead>;
}

const AGENT_FEED_URL = '/api/live-agents/feed';
const HTTP_NOT_FOUND = 404;

/** Only this machine's server has the route; the hosted site answers 404. */
const failed = (error: unknown): AgentFeedRead =>
  error instanceof HttpErrorResponse && error.status === HTTP_NOT_FOUND
    ? { status: 'local-only' }
    : { status: 'unreachable' };

function paramsOf({ session, agentId }: LiveAgentKey, from: number | null): Record<string, string> {
  return {
    session,
    ...(agentId ? { agent: agentId } : {}),
    ...(from === null ? {} : { from: String(from) }),
  };
}

export const AGENT_FEED_API = new InjectionToken<AgentFeedApi>('AGENT_FEED_API', {
  providedIn: 'root',
  factory: () => {
    const http = inject(HttpClient);
    return {
      feed: (key, from) =>
        http.get<unknown>(AGENT_FEED_URL, { params: paramsOf(key, from) }).pipe(
          map((body): AgentFeedRead => {
            const page = parseAgentFeed(body);
            return page ? { status: 'ready', page } : { status: 'unreachable' };
          }),
          catchError((error: unknown) => of(failed(error))),
        ),
    };
  },
});
