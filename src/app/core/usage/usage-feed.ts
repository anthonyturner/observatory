import { HttpClient, HttpHeaders } from '@angular/common/http';
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

/** pr-starmap keeps usage in the `orrery` namespace: it belongs to the
 *  account, not to any one project. */
const USAGE_URL = '/api/doc?ns=orrery&path=usage/current';
/** pr-starmap's site answers its API only to requests that carry this. */
const SITE_HEADERS = new HttpHeaders({ 'x-starmap': '1' });
const REFRESH_MS = 60_000;

interface StoredDocument {
  readonly exists?: boolean;
  readonly data?: unknown;
}

/** Reads Claude Code usage from pr-starmap's site, now and every minute. */
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
    return this.http.get<StoredDocument>(USAGE_URL, { headers: SITE_HEADERS }).pipe(
      map((stored): UsageState => {
        const document = stored.exists ? parseUsageDocument(stored.data) : null;
        return document ? { status: 'ready', document } : { status: 'missing' };
      }),
      catchError(() => of<UsageState>({ status: 'unreachable' })),
    );
  }
}
