import { HttpClient } from '@angular/common/http';
import { Injectable, InjectionToken, Signal, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, catchError, interval, map, of, startWith, switchMap } from 'rxjs';
import { parseNewsReport } from './news-parse';
import { NewsState } from './news.types';

/** Reads the news once, as a state that never errors. */
export type NewsRead = () => Observable<NewsState>;

const NEWS_URL = '/api/news';
/** The server reads the feeds at most every half hour; asking more often gains nothing. */
const REFRESH_MS = 30 * 60_000;

/** One read of the news from Observatory's API. */
export const NEWS_READ = new InjectionToken<NewsRead>('NEWS_READ', {
  providedIn: 'root',
  factory: () => {
    const http = inject(HttpClient);
    return () =>
      http.get<unknown>(NEWS_URL).pipe(
        map((body): NewsState => {
          const report = parseNewsReport(body);
          return report ? { status: 'ready', report } : { status: 'unreachable' };
        }),
        catchError(() => of<NewsState>({ status: 'unreachable' })),
      );
  },
});

/** The news, read now and every half hour; a failed read keeps the headlines already shown. */
@Injectable({ providedIn: 'root' })
export class NewsFeed {
  private readonly read = inject(NEWS_READ);
  private readonly current = signal<NewsState>({ status: 'reading' });

  readonly state = this.current.asReadonly();

  constructor() {
    interval(REFRESH_MS)
      .pipe(
        startWith(0),
        switchMap(() => this.read()),
        takeUntilDestroyed(),
      )
      .subscribe((state) => {
        if (state.status === 'unreachable' && this.current().status === 'ready') return;
        this.current.set(state);
      });
  }
}

/** Where the news stands, for a section to show. */
export const NEWS_STATE = new InjectionToken<Signal<NewsState>>('NEWS_STATE', {
  providedIn: 'root',
  factory: () => inject(NewsFeed).state,
});
