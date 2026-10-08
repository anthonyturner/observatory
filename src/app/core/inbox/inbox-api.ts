import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Injectable, InjectionToken, inject } from '@angular/core';
import { Observable, catchError, map, throwError } from 'rxjs';
import { refusalOf } from '../runs/runs-api';

/** The owner's GitHub notifications, through Observatory's API. */
export interface InboxApi {
  /** The API's answer, unchecked; `fresh` asks it to read GitHub now rather than answer from its cache. */
  read(fresh: boolean): Observable<unknown>;
  /** Completes once GitHub marked the thread read; fails with the API's own words. */
  markRead(threadId: string): Observable<void>;
  /** Marks every thread updated up to `before` (ms since the epoch) read. */
  markAllRead(before: number): Observable<void>;
}

const INBOX_URL = '/api/inbox';
const READ_URL = '/api/inbox/read';
const READ_ALL_URL = '/api/inbox/read-all';
const FRESH = { fresh: '1' };
/** The API accepts writes only with this header, which no other site can add. */
const WRITE_HEADERS = new HttpHeaders({ 'x-observatory': '1' });

@Injectable({ providedIn: 'root' })
export class HttpInboxApi implements InboxApi {
  private readonly http = inject(HttpClient);

  read(fresh: boolean): Observable<unknown> {
    return this.http.get<unknown>(INBOX_URL, { params: fresh ? FRESH : {} });
  }

  markRead(threadId: string): Observable<void> {
    return this.write(READ_URL, { id: threadId });
  }

  markAllRead(before: number): Observable<void> {
    return this.write(READ_ALL_URL, { before: new Date(before).toISOString() });
  }

  private write(url: string, body: object): Observable<void> {
    return this.http.post<unknown>(url, body, { headers: WRITE_HEADERS }).pipe(
      catchError((error: unknown) =>
        throwError(() =>
          error instanceof HttpErrorResponse ? new Error(refusalOf(error)) : error,
        ),
      ),
      map(() => undefined),
    );
  }
}

export const INBOX_API = new InjectionToken<InboxApi>('InboxApi', {
  providedIn: 'root',
  factory: () => inject(HttpInboxApi),
});
