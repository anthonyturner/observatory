import { HttpClient } from '@angular/common/http';
import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { Subscription, catchError, interval, map, of, startWith, switchMap } from 'rxjs';
import { LogSnapshot, isLogSnapshot, parseLogsResponse } from './log-snapshot';

/** Where one repository's Log Sky stands. Only `ready` carries a snapshot. */
export type LogsState =
  | { readonly status: 'reading' }
  | { readonly status: 'unreachable' }
  | { readonly status: 'unconfigured'; readonly reason: 'not-set' | 'not-found' }
  | { readonly status: 'ready'; readonly snapshot: LogSnapshot };

const LOGS_URL = '/api/logs';
/** The API reads a log folder at most every five minutes. */
const REFRESH_MS = 5 * 60_000;

/** Reads one repository's log snapshot, now and every five minutes, while
 *  the view that provides it is open. */
@Injectable()
export class LogsFeed {
  private readonly http = inject(HttpClient);
  private readonly current = signal<LogsState>({ status: 'reading' });
  private watching: Subscription | null = null;

  readonly state = this.current.asReadonly();

  constructor() {
    inject(DestroyRef).onDestroy(() => this.watching?.unsubscribe());
  }

  watch(repo: string): void {
    this.watching?.unsubscribe();
    this.current.set({ status: 'reading' });
    this.watching = interval(REFRESH_MS)
      .pipe(
        startWith(0),
        switchMap(() =>
          this.http.get<unknown>(LOGS_URL, { params: { repo } }).pipe(
            map((body) => stateOf(parseLogsResponse(body))),
            catchError(() => of<LogsState>({ status: 'unreachable' })),
          ),
        ),
      )
      .subscribe((state) => this.current.set(state));
  }
}

function stateOf(response: ReturnType<typeof parseLogsResponse>): LogsState {
  if (isLogSnapshot(response)) return { status: 'ready', snapshot: response };
  return response ? { status: 'unconfigured', reason: response.reason } : { status: 'unreachable' };
}
