import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { Subscription, catchError, map, of } from 'rxjs';
import { LibraryReport, parseLibraryReport } from './library-report';

/** Where one repository's Library stands. Only `ready` carries its pages. */
export type LibraryState =
  | { readonly status: 'reading' }
  | { readonly status: 'unreachable' }
  | { readonly status: 'missing' }
  | { readonly status: 'ready'; readonly report: LibraryReport };

const LIBRARY_URL = '/api/library';
const HTTP_NOT_FOUND = 404;

/** Reads one repository's Library for the page that provides it, once per repository:
 *  moving between its pages reads nothing more. */
@Injectable()
export class LibraryFeed {
  private readonly http = inject(HttpClient);
  private readonly current = signal<LibraryState>({ status: 'reading' });
  private reading: Subscription | null = null;

  readonly state = this.current.asReadonly();

  constructor() {
    inject(DestroyRef).onDestroy(() => this.reading?.unsubscribe());
  }

  /** Reads `repo`'s Library, in place of any it was reading. */
  load(repo: string): void {
    this.reading?.unsubscribe();
    this.current.set({ status: 'reading' });
    this.reading = this.http
      .get<unknown>(LIBRARY_URL, { params: { repo } })
      .pipe(
        map((body): LibraryState => {
          const report = parseLibraryReport(body);
          return report ? { status: 'ready', report } : { status: 'unreachable' };
        }),
        catchError((error: unknown) =>
          of<LibraryState>(
            error instanceof HttpErrorResponse && error.status === HTTP_NOT_FOUND
              ? { status: 'missing' }
              : { status: 'unreachable' },
          ),
        ),
      )
      .subscribe((state) => this.current.set(state));
  }
}
