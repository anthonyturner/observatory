import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import {
  Observable,
  Subject,
  Subscription,
  catchError,
  expand,
  map,
  of,
  startWith,
  switchMap,
  timer,
} from 'rxjs';
import { DeploymentsReport, isReportBuilding, parseDeploymentsReport } from './deployments-report';

/** Where one repository's deployments stand. Only `ready` carries them. */
export type DeploymentsState =
  | { readonly status: 'reading' }
  | { readonly status: 'unreachable' }
  | { readonly status: 'missing' }
  | { readonly status: 'ready'; readonly report: DeploymentsReport };

const DEPLOYMENTS_URL = '/api/deployments';
const HTTP_NOT_FOUND = 404;
/** As often as the API reads GitHub for them; while one builds, often enough to see it land. */
const POLL_MS = 2 * 60_000;
const BUILDING_POLL_MS = 30_000;
/** Past the API's cache, straight to GitHub. */
const FRESH: Readonly<Record<string, string>> = { fresh: '1' };

const pollAfter = (state: DeploymentsState): number =>
  state.status === 'ready' && isReportBuilding(state.report) ? BUILDING_POLL_MS : POLL_MS;

/** Reads one repository's deployments for the page that provides it, again every couple of
 *  minutes, sooner while one is building, and at once, from GitHub, on `refresh`. */
@Injectable()
export class DeploymentsFeed {
  private readonly http = inject(HttpClient);
  private readonly current = signal<DeploymentsState>({ status: 'reading' });
  private readonly refreshes = new Subject<void>();
  private reading: Subscription | null = null;

  readonly state = this.current.asReadonly();

  constructor() {
    inject(DestroyRef).onDestroy(() => this.reading?.unsubscribe());
  }

  /** Reads `repo`'s deployments, in place of any it was reading. */
  load(repo: string): void {
    this.reading?.unsubscribe();
    this.current.set({ status: 'reading' });
    const cached = { repo };
    this.reading = this.refreshes
      .pipe(
        map(() => ({ ...cached, ...FRESH })),
        startWith(cached),
        switchMap((params) =>
          this.read(params).pipe(
            expand((state) => timer(pollAfter(state)).pipe(switchMap(() => this.read(cached)))),
          ),
        ),
      )
      .subscribe((state) => this.settle(state));
  }

  refresh(): void {
    this.refreshes.next();
  }

  private read(params: Readonly<Record<string, string>>): Observable<DeploymentsState> {
    return this.http.get<unknown>(DEPLOYMENTS_URL, { params }).pipe(
      map((body): DeploymentsState => {
        const report = parseDeploymentsReport(body);
        return report ? { status: 'ready', report } : { status: 'unreachable' };
      }),
      catchError((error: unknown) =>
        of<DeploymentsState>(
          error instanceof HttpErrorResponse && error.status === HTTP_NOT_FOUND
            ? { status: 'missing' }
            : { status: 'unreachable' },
        ),
      ),
    );
  }

  /** A later read that fails keeps the deployments already on screen rather than blanking them. */
  private settle(state: DeploymentsState): void {
    if (state.status === 'unreachable' && this.current().status === 'ready') return;
    this.current.set(state);
  }
}
