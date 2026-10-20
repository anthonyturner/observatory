import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  Observable,
  Subject,
  Subscription,
  catchError,
  interval,
  map,
  merge,
  of,
  startWith,
  switchMap,
} from 'rxjs';
import { LogSnapshot, isLogSnapshot, parseLogsResponse } from './log-snapshot';

/** Where one repository's Log Sky stands. Only `ready` carries a snapshot. */
export type LogsState =
  | { readonly status: 'reading' }
  | { readonly status: 'unreachable' }
  | { readonly status: 'unconfigured'; readonly reason: 'not-set' | 'not-found' }
  | { readonly status: 'ready'; readonly snapshot: LogSnapshot };

/** Why a clear or reset did not take: the API was not there, or it answered with a refusal. */
export type LogChangeFailure = 'unreachable' | 'rejected';

const LOGS_URL = '/api/logs';
const CLEAR_URL = '/api/logs/clear';
/** The API accepts writes only with this header, which no other site can add. */
const WRITE_HEADERS = new HttpHeaders({ 'x-observatory': '1' });
/** The API reads a log folder at most every five minutes. */
const REFRESH_MS = 5 * 60_000;

/** Reads one repository's log snapshot, now and every five minutes, while
 *  the view that provides it is open; reads it again on demand, and clears or
 *  resets what the sky counts. */
@Injectable()
export class LogsFeed {
  private readonly http = inject(HttpClient);
  private readonly destroyRef = inject(DestroyRef);
  private readonly current = signal<LogsState>({ status: 'reading' });
  private readonly waiting = signal(false);
  private readonly failed = signal<LogChangeFailure | null>(null);
  private readonly asked = new Subject<void>();
  private repo: string | null = null;
  private watching: Subscription | null = null;

  readonly state = this.current.asReadonly();
  /** A clear, a reset or an on-demand read is on its way: the sky has not caught up yet. */
  readonly isWaiting = this.waiting.asReadonly();
  /** Why the last clear or reset did not take, or null when it did. */
  readonly failure = this.failed.asReadonly();

  constructor() {
    this.destroyRef.onDestroy(() => this.watching?.unsubscribe());
  }

  watch(repo: string): void {
    this.watching?.unsubscribe();
    this.repo = repo;
    this.current.set({ status: 'reading' });
    this.waiting.set(false);
    this.failed.set(null);
    this.watching = merge(
      interval(REFRESH_MS).pipe(
        startWith(0),
        map(() => false),
      ),
      this.asked.pipe(map(() => true)),
    )
      .pipe(switchMap((fresh) => this.read(repo, fresh)))
      .subscribe((state) => {
        this.current.set(state);
        this.waiting.set(false);
      });
  }

  /** Reads the folder again now, not the copy the API kept. Nothing happens before `watch`. */
  refresh(): void {
    if (this.repo === null) return;
    this.waiting.set(true);
    this.asked.next();
  }

  /** The sky ignores every line logged up to now. */
  clearToNow(): void {
    this.change((repo) => this.http.post<unknown>(CLEAR_URL, { repo }, { headers: WRITE_HEADERS }));
  }

  /** Every line counts again. */
  restore(): void {
    this.change((repo) =>
      this.http.delete<unknown>(CLEAR_URL, { params: { repo }, headers: WRITE_HEADERS }),
    );
  }

  private read(repo: string, fresh: boolean): Observable<LogsState> {
    const params: Record<string, string> = fresh ? { repo, fresh: '1' } : { repo };
    return this.http.get<unknown>(LOGS_URL, { params }).pipe(
      map((body) => stateOf(parseLogsResponse(body))),
      catchError(() => of<LogsState>({ status: 'unreachable' })),
    );
  }

  /** The API answers a change at once; the folder is read again afterwards, which is the slow part. */
  private change(send: (repo: string) => Observable<unknown>): void {
    if (this.repo === null) return;
    this.failed.set(null);
    this.waiting.set(true);
    send(this.repo)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.asked.next(),
        error: (error: unknown) => {
          this.failed.set(
            error instanceof HttpErrorResponse && error.status === 0 ? 'unreachable' : 'rejected',
          );
          this.waiting.set(false);
        },
      });
  }
}

function stateOf(response: ReturnType<typeof parseLogsResponse>): LogsState {
  if (isLogSnapshot(response)) return { status: 'ready', snapshot: response };
  return response ? { status: 'unconfigured', reason: response.reason } : { status: 'unreachable' };
}
