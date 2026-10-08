import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import {
  EMPTY,
  Observable,
  Subject,
  catchError,
  distinctUntilChanged,
  interval,
  map,
  merge,
  of,
  startWith,
  switchMap,
  tap,
} from 'rxjs';
import { ViewerSession } from '../session/viewer-session';
import { INBOX_API } from './inbox-api';
import { InboxItem, InboxReport, parseInboxReport } from './inbox-report';

/**
 * Where the inbox stands. Only `ready` carries it; `private` is a preview
 * visitor's, who never sees the owner's notifications.
 */
export type InboxState =
  | { readonly status: 'reading' }
  | { readonly status: 'unreachable' }
  | { readonly status: 'private' }
  | { readonly status: 'ready'; readonly report: InboxReport };

/** The API reads GitHub at most once a minute, as GitHub asks; every two is plenty for a count. */
const POLL_MS = 2 * 60_000;
const HTTP_FORBIDDEN = 403;
const PRIVATE: InboxState = { status: 'private' };

/**
 * The owner's unread GitHub notifications, read now and every few minutes,
 * shared by the Inbox page and the way to it, so marking one read shows on
 * both at once. A viewer who may not write is never asked for them.
 */
@Injectable({ providedIn: 'root' })
export class InboxFeed {
  private readonly api = inject(INBOX_API);
  private readonly current = signal<InboxState>({ status: 'reading' });
  private readonly refreshes = new Subject<void>();

  readonly state = this.current.asReadonly();
  /** How many are unread; null while that is not known. */
  readonly unreadCount = computed(() => {
    const state = this.state();
    return state.status === 'ready' && state.report.status === 'read'
      ? state.report.items.length
      : null;
  });

  constructor() {
    toObservable(inject(ViewerSession).canWrite)
      .pipe(
        distinctUntilChanged(),
        switchMap((canWrite) => (canWrite ? this.polling() : of(PRIVATE))),
        takeUntilDestroyed(),
      )
      .subscribe((state) => this.settle(state));
  }

  /** Reads GitHub now, rather than the API's copy of up to a minute ago. */
  refresh(): void {
    this.refreshes.next();
  }

  /** Marks one read on GitHub, and takes it off the list once GitHub has. */
  markRead(threadId: string): Observable<void> {
    return this.api.markRead(threadId).pipe(tap(() => this.drop((item) => item.id === threadId)));
  }

  /** Marks everything listed read, but not what came after GitHub was read for this list. */
  markAllRead(): Observable<void> {
    const state = this.state();
    if (state.status !== 'ready') return EMPTY;
    const before = state.report.generatedAt;
    return this.api
      .markAllRead(before)
      .pipe(tap(() => this.drop((item) => item.updatedAt <= before)));
  }

  private polling(): Observable<InboxState> {
    const regular = interval(POLL_MS).pipe(
      startWith(0),
      map(() => false),
    );
    const asked = this.refreshes.pipe(map(() => true));
    return merge(regular, asked).pipe(switchMap((fresh) => this.read(fresh)));
  }

  private read(fresh: boolean): Observable<InboxState> {
    return this.api.read(fresh).pipe(
      map((body): InboxState => {
        const report = parseInboxReport(body);
        return report ? { status: 'ready', report } : { status: 'unreachable' };
      }),
      catchError((error: unknown) =>
        of<InboxState>(
          error instanceof HttpErrorResponse && error.status === HTTP_FORBIDDEN
            ? PRIVATE
            : { status: 'unreachable' },
        ),
      ),
    );
  }

  /** A later read that fails keeps the list already on screen rather than blanking it. */
  private settle(state: InboxState): void {
    if (state.status === 'unreachable' && this.current().status === 'ready') return;
    this.current.set(state);
  }

  private drop(isGone: (item: InboxItem) => boolean): void {
    const state = this.current();
    if (state.status !== 'ready') return;
    const items = state.report.items.filter((item) => !isGone(item));
    this.current.set({ status: 'ready', report: { ...state.report, items } });
  }
}
