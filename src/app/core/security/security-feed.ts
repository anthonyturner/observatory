import { HttpClient, HttpErrorResponse } from '@angular/common/http';
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
import { SECURITY_URL } from './alert-counts';
import { SecurityReport, parseSecurityReport } from './security-report';

/** Where one repository's alerts stand. Only `ready` carries them. */
export type SecurityState =
  | { readonly status: 'reading' }
  | { readonly status: 'unreachable' }
  | { readonly status: 'missing' }
  | { readonly status: 'ready'; readonly report: SecurityReport };

const HTTP_NOT_FOUND = 404;
/** As often as the API reads GitHub for them. */
const POLL_MS = 5 * 60_000;

/** Reads one repository's open alerts for the page that provides it, and again every few minutes. */
@Injectable()
export class SecurityFeed {
  private readonly http = inject(HttpClient);
  private readonly current = signal<SecurityState>({ status: 'reading' });
  private reading: Subscription | null = null;

  readonly state = this.current.asReadonly();

  constructor() {
    inject(DestroyRef).onDestroy(() => this.reading?.unsubscribe());
  }

  /** Reads `repo`'s alerts, in place of any it was reading. */
  load(repo: string): void {
    this.reading?.unsubscribe();
    this.current.set({ status: 'reading' });
    this.reading = interval(POLL_MS)
      .pipe(
        startWith(0),
        switchMap(() => this.read(repo)),
      )
      .subscribe((state) => this.settle(state));
  }

  private read(repo: string): Observable<SecurityState> {
    return this.http.get<unknown>(SECURITY_URL, { params: { repo } }).pipe(
      map((body): SecurityState => {
        const report = parseSecurityReport(body);
        return report ? { status: 'ready', report } : { status: 'unreachable' };
      }),
      catchError((error: unknown) =>
        of<SecurityState>(
          error instanceof HttpErrorResponse && error.status === HTTP_NOT_FOUND
            ? { status: 'missing' }
            : { status: 'unreachable' },
        ),
      ),
    );
  }

  /** A later read that fails keeps the alerts already on screen rather than blanking them. */
  private settle(state: SecurityState): void {
    if (state.status === 'unreachable' && this.current().status === 'ready') return;
    this.current.set(state);
  }
}
