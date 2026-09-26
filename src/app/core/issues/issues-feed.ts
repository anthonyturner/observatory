import { HttpClient } from '@angular/common/http';
import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import {
  Observable,
  Subscription,
  catchError,
  interval,
  map,
  of,
  startWith,
  switchMap,
} from 'rxjs';
import { IssuesReport, parseIssuesReport } from './issues-report';

/** Where one repository's issues stand. Only `ready` carries them. */
export type IssuesState =
  | { readonly status: 'reading' }
  | { readonly status: 'unreachable' }
  | { readonly status: 'ready'; readonly report: IssuesReport };

const ISSUES_URL = '/api/issues';
/** The API reads GitHub at most every two minutes for a repository. */
const REFRESH_MS = 2 * 60_000;

/** Reads one repository's issues, now and every two minutes, while the page
 *  that provides it is open. A failed read keeps the issues already shown. */
@Injectable()
export class IssuesFeed {
  private readonly http = inject(HttpClient);
  private readonly current = signal<IssuesState>({ status: 'reading' });
  private watching: Subscription | null = null;

  readonly state = this.current.asReadonly();

  constructor() {
    inject(DestroyRef).onDestroy(() => this.watching?.unsubscribe());
  }

  /** Starts reading `repo`'s issues, in place of any it was reading. */
  watch(repo: string): void {
    this.watching?.unsubscribe();
    this.current.set({ status: 'reading' });
    this.watching = interval(REFRESH_MS)
      .pipe(
        startWith(0),
        switchMap(() => this.fetch(repo)),
      )
      .subscribe((state) => this.keep(state));
  }

  /** Reads them again now, keeping what is shown until the answer comes. */
  refresh(repo: string): void {
    this.fetch(repo).subscribe((state) => this.keep(state));
  }

  private keep(read: IssuesState): void {
    this.current.update((now) =>
      read.status === 'unreachable' && now.status === 'ready' ? now : read,
    );
  }

  private fetch(repo: string): Observable<IssuesState> {
    return this.http.get<unknown>(ISSUES_URL, { params: { repo } }).pipe(
      map((body): IssuesState => {
        const report = parseIssuesReport(body);
        return report ? { status: 'ready', report } : { status: 'unreachable' };
      }),
      catchError(() => of<IssuesState>({ status: 'unreachable' })),
    );
  }
}
