import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { InjectionToken, inject } from '@angular/core';
import { Observable, catchError, map, of } from 'rxjs';
import { parseLiveAgents, parseOneAgent } from './live-agents-parse';
import { LiveAgentKey, LiveAgentsGap, LiveAgentsState, OneAgentState } from './live-agents.types';

/** Reads the agents running on this machine, each read as a state that never errors. */
export interface LiveAgentsApi {
  list(): Observable<LiveAgentsState>;
  one(key: LiveAgentKey): Observable<OneAgentState>;
}

const LIVE_AGENTS_URL = '/api/live-agents';
const HTTP_NOT_FOUND = 404;

/** Only this machine's server has the route, so the hosted site answers 404:
 *  that is not a failure, it is where the page is being read. */
const failed = (error: unknown): LiveAgentsGap =>
  error instanceof HttpErrorResponse && error.status === HTTP_NOT_FOUND
    ? { status: 'local-only' }
    : { status: 'unreachable' };

const UNREADABLE: LiveAgentsGap = { status: 'unreachable' };
const HTTP_BAD_REQUEST = 400;

/** Ids the server will not read, typed into the address: no agent has them. */
const oneFailed = (error: unknown): OneAgentState =>
  error instanceof HttpErrorResponse && error.status === HTTP_BAD_REQUEST
    ? { status: 'ready', agent: null }
    : failed(error);

export const LIVE_AGENTS_API = new InjectionToken<LiveAgentsApi>('LIVE_AGENTS_API', {
  providedIn: 'root',
  factory: () => {
    const http = inject(HttpClient);
    return {
      list: () =>
        http.get<unknown>(LIVE_AGENTS_URL).pipe(
          map((body): LiveAgentsState => {
            const agents = parseLiveAgents(body);
            return agents ? { status: 'ready', agents } : UNREADABLE;
          }),
          catchError((error: unknown) => of(failed(error))),
        ),
      one: ({ session, agentId }) => {
        const params: Record<string, string> = agentId ? { session, agent: agentId } : { session };
        return http.get<unknown>(LIVE_AGENTS_URL, { params }).pipe(
          map((body): OneAgentState => {
            const agent = parseOneAgent(body);
            return agent === undefined ? UNREADABLE : { status: 'ready', agent };
          }),
          catchError((error: unknown) => of(oneFailed(error))),
        );
      },
    };
  },
});
