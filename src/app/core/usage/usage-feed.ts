import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, interval, map, of, startWith, switchMap } from 'rxjs';
import { UsageDocument, parseUsageDocument } from './usage-document';

/** Where the usage document stands. Only `ready` carries readings. */
export type UsageState =
  | { readonly status: 'reading' }
  | { readonly status: 'unreachable' }
  | { readonly status: 'missing' }
  | { readonly status: 'ready'; readonly document: UsageDocument };

/** Observatory's own API (server/), which reads Claude Code's files on this machine. */
const USAGE_URL = '/api/usage';
const REFRESH_MS = 60_000;

/** Reads Claude Code usage from Observatory's API, now and every minute. */
@Injectable({ providedIn: 'root' })
export class UsageFeed {
  private readonly http = inject(HttpClient);
  private readonly current = signal<UsageState>({ status: 'reading' });

  readonly state = this.current.asReadonly();

  constructor() {
    interval(REFRESH_MS)
      .pipe(
        startWith(0),
        switchMap(() => this.fetch()),
        takeUntilDestroyed(),
      )
      .subscribe((state) => this.current.set(state));
  }

  private fetch() {
    return this.http.get<unknown>(USAGE_URL).pipe(
      map((body): UsageState => {
        const document = parseUsageDocument(body);
        return document ? { status: 'ready', document } : { status: 'missing' };
      }),
      catchError(() => of<UsageState>({ status: 'unreachable' })),
    );
  }
}
