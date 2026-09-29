import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { Subscription, catchError, interval, map, of, startWith, switchMap } from 'rxjs';
import { QueueReport, parseQueueReport } from './queue-report';

/** Where one repository's queue stands. Only `ready` carries it; a `ready`
 *  queue is stale when reads since have failed, and is kept rather than lost. */
export type QueueState =
  | { readonly status: 'reading' }
  | { readonly status: 'unreachable' }
  | { readonly status: 'refused'; readonly reason: string }
  | { readonly status: 'ready'; readonly report: QueueReport; readonly isStale?: boolean };

/** The state after a read: a failed read keeps the queue already shown, marked
 *  stale, so the sky fogs over instead of vanishing. A refusal still replaces it. */
export function nextQueueState(previous: QueueState, read: QueueState): QueueState {
  if (read.status === 'unreachable' && previous.status === 'ready') {
    return { ...previous, isStale: true };
  }
  return read;
}

const QUEUE_URL = '/api/queue';
/** The API reads GitHub at most every two minutes for a queue. */
const REFRESH_MS = 2 * 60_000;
const HTTP_BAD_REQUEST = 400;

/** Reads one repository's review queue, now and every two minutes, for as
 *  long as the page that provides it is open. */
@Injectable()
export class QueueFeed {
  private readonly http = inject(HttpClient);
  private readonly current = signal<QueueState>({ status: 'reading' });
  private watching: Subscription | null = null;

  readonly state = this.current.asReadonly();

  constructor() {
    inject(DestroyRef).onDestroy(() => this.watching?.unsubscribe());
  }

  /** Reads the queue again now, keeping what is shown until the answer comes:
   *  after a triage action, which the API merges in on every read, or, `fresh`,
   *  from GitHub rather than the API's cache, for Refresh. */
  refresh(repo: string, fresh = false): void {
    this.fetch(repo, fresh).subscribe((state) =>
      this.current.update((now) => nextQueueState(now, state)),
    );
  }

  /** Starts reading `repo`'s queue, in place of any it was reading. */
  watch(repo: string): void {
    this.watching?.unsubscribe();
    this.current.set({ status: 'reading' });
    this.watching = interval(REFRESH_MS)
      .pipe(
        startWith(0),
        switchMap(() => this.fetch(repo)),
      )
      .subscribe((state) => this.current.update((now) => nextQueueState(now, state)));
  }

  private fetch(repo: string, fresh = false) {
    const params: Record<string, string> = fresh ? { repo, fresh: '1' } : { repo };
    return this.http.get<unknown>(QUEUE_URL, { params }).pipe(
      map((body): QueueState => {
        const report = parseQueueReport(body);
        return report ? { status: 'ready', report } : { status: 'unreachable' };
      }),
      catchError((error: unknown) =>
        of<QueueState>(
          error instanceof HttpErrorResponse && error.status === HTTP_BAD_REQUEST
            ? { status: 'refused', reason: String(error.error?.error ?? 'bad request') }
            : { status: 'unreachable' },
        ),
      ),
    );
  }
}
