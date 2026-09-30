import { HttpClient } from '@angular/common/http';
import { Injectable, InjectionToken, Signal, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, catchError, interval, map, of, startWith, switchMap } from 'rxjs';
import { AgentRun, AgentUsageDocument, parseAgentUsage } from './agent-usage-document';

/** Where the agent report stands. Only `ready` carries runs. */
export type AgentUsageState =
  | { readonly status: 'reading' }
  | { readonly status: 'unreachable' }
  | { readonly status: 'missing' }
  | { readonly status: 'ready'; readonly document: AgentUsageDocument };

export type AgentUsageRead = () => Observable<AgentUsageState>;

const AGENT_USAGE_URL = '/api/agent-usage';
/** Runs finish every few minutes at most; the server reads only changed logs. */
const REFRESH_MS = 5 * 60_000;

/** One read of the agent report from Observatory's API, as a state that never errors. */
export const AGENT_USAGE_READ = new InjectionToken<AgentUsageRead>('AGENT_USAGE_READ', {
  providedIn: 'root',
  factory: () => {
    const http = inject(HttpClient);
    return () =>
      http.get<unknown>(AGENT_USAGE_URL).pipe(
        map((body): AgentUsageState => {
          const document = parseAgentUsage(body);
          return document ? { status: 'ready', document } : { status: 'missing' };
        }),
        catchError(() => of<AgentUsageState>({ status: 'unreachable' })),
      );
  },
});

/** Each subagent run of the last month, now and every five minutes. */
@Injectable({ providedIn: 'root' })
export class AgentUsageFeed {
  private readonly read = inject(AGENT_USAGE_READ);
  private readonly current = signal<AgentUsageState>({ status: 'reading' });

  readonly state = this.current.asReadonly();
  /** Every run, newest first; none until the report is read. */
  readonly runs: Signal<readonly AgentRun[]> = computed(() => {
    const state = this.current();
    return state.status === 'ready' ? state.document.runs : [];
  });

  constructor() {
    interval(REFRESH_MS)
      .pipe(
        startWith(0),
        switchMap(() => this.read()),
        takeUntilDestroyed(),
      )
      .subscribe((state) => this.current.set(state));
  }
}
