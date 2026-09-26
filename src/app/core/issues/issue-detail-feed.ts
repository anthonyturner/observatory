import { HttpClient } from '@angular/common/http';
import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { Observable, Subscription, catchError, map, of } from 'rxjs';
import { IssueDetail, parseIssueDetail } from './issue-detail';

/** Where one issue's description stands. */
export type IssueDetailState =
  | { readonly status: 'reading' }
  | { readonly status: 'failed' }
  | { readonly status: 'ready'; readonly detail: IssueDetail };

/** What the last Refresh came to, for the window's status line. */
export type RefetchOutcome = 'fetching' | 'updated' | 'kept' | null;

const ISSUE_URL = '/api/issue';
/** Asks the API for the issue anew rather than its cached copy. */
const FRESH = { fresh: '1' };

/** Reads one issue with its description, for the issue window that provides it. */
@Injectable()
export class IssueDetailFeed {
  private readonly http = inject(HttpClient);
  private readonly current = signal<IssueDetailState>({ status: 'reading' });
  private readonly outcome = signal<RefetchOutcome>(null);
  private target: { repo: string; number: number } | null = null;
  private reading: Subscription | null = null;

  readonly state = this.current.asReadonly();
  readonly refetch = this.outcome.asReadonly();

  constructor() {
    inject(DestroyRef).onDestroy(() => this.reading?.unsubscribe());
  }

  /** Reads `repo`'s issue `number`, in place of any it was reading. */
  load(repo: string, number: number): void {
    this.target = { repo, number };
    this.outcome.set(null);
    this.current.set({ status: 'reading' });
    this.read({}, (detail) =>
      this.current.set(detail ? { status: 'ready', detail } : { status: 'failed' }),
    );
  }

  /** Reads it again from GitHub; a failure keeps the copy already shown. */
  refresh(): void {
    const shown = this.current();
    this.outcome.set('fetching');
    if (shown.status !== 'ready') this.current.set({ status: 'reading' });
    this.read(FRESH, (detail) => {
      if (detail) {
        this.current.set({ status: 'ready', detail });
        this.outcome.set(shown.status === 'ready' ? 'updated' : null);
      } else if (shown.status === 'ready') {
        this.outcome.set('kept');
      } else {
        this.current.set({ status: 'failed' });
        this.outcome.set(null);
      }
    });
  }

  private read(params: Record<string, string>, done: (detail: IssueDetail | null) => void): void {
    const target = this.target;
    if (!target) return;
    this.reading?.unsubscribe();
    this.reading = this.fetch(target.repo, target.number, params).subscribe(done);
  }

  private fetch(
    repo: string,
    number: number,
    params: Record<string, string>,
  ): Observable<IssueDetail | null> {
    return this.http.get<unknown>(ISSUE_URL, { params: { repo, number, ...params } }).pipe(
      map(parseIssueDetail),
      catchError(() => of(null)),
    );
  }
}
