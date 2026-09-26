import { HttpClient } from '@angular/common/http';
import { InjectionToken, inject } from '@angular/core';
import { Observable, catchError, map, of } from 'rxjs';
import { UsageDocument, parseUsageDocument } from './usage-document';

/** Where the usage document stands. Only `ready` carries readings. */
export type UsageState =
  | { readonly status: 'reading' }
  | { readonly status: 'unreachable' }
  | { readonly status: 'missing' }
  | { readonly status: 'ready'; readonly document: UsageDocument };

/** Reads Claude Code usage once, as a state that never errors. */
export type UsageRead = () => Observable<UsageState>;

/** Observatory's own API (server/), which reads Claude Code's files on this machine. */
const USAGE_URL = '/api/usage';

/** One read of the usage report from Observatory's API. */
export const USAGE_READ = new InjectionToken<UsageRead>('USAGE_READ', {
  providedIn: 'root',
  factory: () => {
    const http = inject(HttpClient);
    return () =>
      http.get<unknown>(USAGE_URL).pipe(
        map((body): UsageState => {
          const document = parseUsageDocument(body);
          return document ? { status: 'ready', document } : { status: 'missing' };
        }),
        catchError(() => of<UsageState>({ status: 'unreachable' })),
      );
  },
});
