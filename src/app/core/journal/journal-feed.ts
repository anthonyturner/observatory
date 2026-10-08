import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { Subscription, catchError, map, of } from 'rxjs';
import { JournalReport, parseJournalReport } from './journal-report';

/** Where one repository's journal stands. Only `ready` carries the entries. */
export type JournalState =
  | { readonly status: 'reading' }
  | { readonly status: 'unreachable' }
  | { readonly status: 'missing' }
  | { readonly status: 'ready'; readonly report: JournalReport };

const JOURNAL_URL = '/api/journal';
const HTTP_NOT_FOUND = 404;

/** Reads one repository's journal for the page that provides it. A review is
 *  posted a few times a day, so it reads once per repository rather than on a timer. */
@Injectable()
export class JournalFeed {
  private readonly http = inject(HttpClient);
  private readonly current = signal<JournalState>({ status: 'reading' });
  private reading: Subscription | null = null;

  readonly state = this.current.asReadonly();

  constructor() {
    inject(DestroyRef).onDestroy(() => this.reading?.unsubscribe());
  }

  /** Reads `repo`'s journal, in place of any it was reading. */
  load(repo: string): void {
    this.reading?.unsubscribe();
    this.current.set({ status: 'reading' });
    this.reading = this.http
      .get<unknown>(JOURNAL_URL, { params: { repo } })
      .pipe(
        map((body): JournalState => {
          const report = parseJournalReport(body);
          return report ? { status: 'ready', report } : { status: 'unreachable' };
        }),
        catchError((error: unknown) =>
          of<JournalState>(
            error instanceof HttpErrorResponse && error.status === HTTP_NOT_FOUND
              ? { status: 'missing' }
              : { status: 'unreachable' },
          ),
        ),
      )
      .subscribe((state) => this.current.set(state));
  }
}
