import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { Subscription, catchError, map, of } from 'rxjs';
import { InsightsReport, parseInsightsReport } from './insights-report';

/** Where one repository's insights stand. Only `ready` carries them. */
export type InsightsState =
  | { readonly status: 'reading' }
  | { readonly status: 'unreachable' }
  | { readonly status: 'missing' }
  | { readonly status: 'ready'; readonly report: InsightsReport };

const INSIGHTS_URL = '/api/insights';
const HTTP_NOT_FOUND = 404;
/** Past the API's cache, straight to GitHub. */
const FRESH: Readonly<Record<string, string>> = { fresh: '1' };

/** Reads one repository's insights for the page that provides it. Weekly counts
 *  move slowly, so it reads once per repository, and again when asked to. */
@Injectable()
export class InsightsFeed {
  private readonly http = inject(HttpClient);
  private readonly current = signal<InsightsState>({ status: 'reading' });
  private reading: Subscription | null = null;
  private repo = '';

  readonly state = this.current.asReadonly();

  constructor() {
    inject(DestroyRef).onDestroy(() => this.reading?.unsubscribe());
  }

  /** Reads `repo`'s insights, in place of any it was reading. */
  load(repo: string): void {
    this.repo = repo;
    this.current.set({ status: 'reading' });
    this.read({ repo });
  }

  /** Asks GitHub again, for when it was still counting; what is on screen stays meanwhile. */
  recount(): void {
    if (this.repo) this.read({ repo: this.repo, ...FRESH });
  }

  private read(params: Readonly<Record<string, string>>): void {
    this.reading?.unsubscribe();
    this.reading = this.http
      .get<unknown>(INSIGHTS_URL, { params })
      .pipe(
        map((body): InsightsState => {
          const report = parseInsightsReport(body);
          return report ? { status: 'ready', report } : { status: 'unreachable' };
        }),
        catchError((error: unknown) =>
          of<InsightsState>(
            error instanceof HttpErrorResponse && error.status === HTTP_NOT_FOUND
              ? { status: 'missing' }
              : { status: 'unreachable' },
          ),
        ),
      )
      .subscribe((state) => this.settle(state));
  }

  /** A later read that fails keeps the insights already on screen rather than blanking them. */
  private settle(state: InsightsState): void {
    if (state.status === 'unreachable' && this.current().status === 'ready') return;
    this.current.set(state);
  }
}
