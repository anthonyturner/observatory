import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { Subscription, catchError, map, of } from 'rxjs';
import { ReleasesReport, parseReleasesReport } from './releases-report';

/** Where one repository's releases stand. Only `ready` carries them. */
export type ReleasesState =
  | { readonly status: 'reading' }
  | { readonly status: 'unreachable' }
  | { readonly status: 'missing' }
  | { readonly status: 'ready'; readonly report: ReleasesReport };

const RELEASES_URL = '/api/releases';
const HTTP_NOT_FOUND = 404;

/** Reads one repository's releases for the page that provides it. A release is
 *  cut rarely, so it reads once per repository rather than on a timer. */
@Injectable()
export class ReleasesFeed {
  private readonly http = inject(HttpClient);
  private readonly current = signal<ReleasesState>({ status: 'reading' });
  private reading: Subscription | null = null;

  readonly state = this.current.asReadonly();

  constructor() {
    inject(DestroyRef).onDestroy(() => this.reading?.unsubscribe());
  }

  /** Reads `repo`'s releases, in place of any it was reading. */
  load(repo: string): void {
    this.reading?.unsubscribe();
    this.current.set({ status: 'reading' });
    this.reading = this.http
      .get<unknown>(RELEASES_URL, { params: { repo } })
      .pipe(
        map((body): ReleasesState => {
          const report = parseReleasesReport(body);
          return report ? { status: 'ready', report } : { status: 'unreachable' };
        }),
        catchError((error: unknown) =>
          of<ReleasesState>(
            error instanceof HttpErrorResponse && error.status === HTTP_NOT_FOUND
              ? { status: 'missing' }
              : { status: 'unreachable' },
          ),
        ),
      )
      .subscribe((state) => this.current.set(state));
  }
}
