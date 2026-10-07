import { HttpClient } from '@angular/common/http';
import { InjectionToken, inject } from '@angular/core';
import { Observable, catchError, map, of } from 'rxjs';
import { readQueue } from '../queue/queue-feed';
import { parseAgentChanges } from './agent-changes-parse';
import { AgentChangesState } from './agent-changes.types';
import { failed } from './live-agents-api';
import { LiveAgentKey } from './live-agents.types';

/** Reads an agent's changes, each read as a state that never errors. */
export interface AgentChangesApi {
  changes(key: LiveAgentKey): Observable<AgentChangesState>;
  /** The open pull request in `repo`'s queue whose head is `branch`, or null. */
  openPullOf(repo: string, branch: string): Observable<number | null>;
}

const AGENT_CHANGES_URL = '/api/live-agents/changes';
const UNREADABLE: AgentChangesState = { status: 'unreachable' };

export const AGENT_CHANGES_API = new InjectionToken<AgentChangesApi>('AGENT_CHANGES_API', {
  providedIn: 'root',
  factory: () => {
    const http = inject(HttpClient);
    return {
      changes: ({ session, agentId }) => {
        const params: Record<string, string> = agentId ? { session, agent: agentId } : { session };
        return http.get<unknown>(AGENT_CHANGES_URL, { params }).pipe(
          map((body) => parseAgentChanges(body) ?? UNREADABLE),
          catchError((error: unknown) => of(failed(error))),
        );
      },
      // The queue the Review Queue already reads, through the API's cache, rather than a new GitHub search.
      openPullOf: (repo, branch) =>
        readQueue(http, repo).pipe(
          map((state) =>
            state.status === 'ready'
              ? (state.report.items.find((item) => item.branch === branch)?.number ?? null)
              : null,
          ),
        ),
    };
  },
});
