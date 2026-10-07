import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Injectable, InjectionToken, inject } from '@angular/core';
import { Observable, catchError, map, throwError } from 'rxjs';
import { refusalOf } from '../runs/runs-api';

/** Reruns a failed workflow run's failed jobs on GitHub, through Observatory's API. */
export interface RunRerunApi {
  /** Completes once GitHub took it; fails with the API's own words. */
  rerun(repo: string, runId: number): Observable<void>;
}

const RERUN_URL = '/api/actions/rerun';
/** The API accepts writes only with this header, which no other site can add. */
const WRITE_HEADERS = new HttpHeaders({ 'x-observatory': '1' });

@Injectable({ providedIn: 'root' })
export class HttpRunRerunApi implements RunRerunApi {
  private readonly http = inject(HttpClient);

  rerun(repo: string, runId: number): Observable<void> {
    return this.http
      .post<unknown>(RERUN_URL, { repo, run: runId }, { headers: WRITE_HEADERS })
      .pipe(
        catchError((error: unknown) =>
          throwError(() =>
            error instanceof HttpErrorResponse ? new Error(refusalOf(error)) : error,
          ),
        ),
        map(() => undefined),
      );
  }
}

export const RUN_RERUN_API = new InjectionToken<RunRerunApi>('RunRerunApi', {
  providedIn: 'root',
  factory: () => inject(HttpRunRerunApi),
});
