import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { DestroyRef, Injectable, inject, signal } from '@angular/core';
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
import { ActionsReport, parseActionsReport } from './actions-report';

/** Where one repository's runs stand. Only `ready` carries them. */
export type ActionsState =
  | { readonly status: 'reading' }
  | { readonly status: 'unreachable' }
  | { readonly status: 'missing' }
  | { readonly status: 'ready'; readonly report: ActionsReport };

const ACTIONS_URL = '/api/actions';
const HTTP_NOT_FOUND = 404;
/** As often as the API reads GitHub for them, so a run that ends shows within minutes. */
const POLL_MS = 2 * 60_000;

/** Reads one repository's workflow runs for the page that provides it, again every
 *  couple of minutes, and at once, from GitHub rather than the cache, on `refresh`. */
@Injectable()
export class ActionsFeed {
  private readonly http = inject(HttpClient);
  private readonly current = signal<ActionsState>({ status: 'reading' });
  private readonly refreshes = new Subject<void>();
  private reading: Subscription | null = null;

  readonly state = this.current.asReadonly();

  constructor() {
    inject(DestroyRef).onDestroy(() => this.reading?.unsubscribe());
  }

  /** Reads `repo`'s runs, in place of any it was reading. */
  load(repo: string): void {
    this.reading?.unsubscribe();
    this.current.set({ status: 'reading' });
    const polls = interval(POLL_MS).pipe(
      startWith(0),
      map(() => false),
    );
    this.reading = merge(polls, this.refreshes.pipe(map(() => true)))
      .pipe(switchMap((isFresh) => this.read(repo, isFresh)))
      .subscribe((state) => this.settle(state));
  }

  refresh(): void {
    this.refreshes.next();
  }

  private read(repo: string, isFresh: boolean): Observable<ActionsState> {
    const params: Record<string, string> = isFresh ? { repo, fresh: '1' } : { repo };
    return this.http.get<unknown>(ACTIONS_URL, { params }).pipe(
      map((body): ActionsState => {
        const report = parseActionsReport(body);
        return report ? { status: 'ready', report } : { status: 'unreachable' };
      }),
      catchError((error: unknown) =>
        of<ActionsState>(
          error instanceof HttpErrorResponse && error.status === HTTP_NOT_FOUND
            ? { status: 'missing' }
            : { status: 'unreachable' },
        ),
      ),
    );
  }

  /** A later read that fails keeps the runs already on screen rather than blanking them. */
  private settle(state: ActionsState): void {
    if (state.status === 'unreachable' && this.current().status === 'ready') return;
    this.current.set(state);
  }
}
