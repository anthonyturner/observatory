import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Injectable, InjectionToken, inject } from '@angular/core';
import { Observable, catchError, map, throwError } from 'rxjs';
import { isObject } from '../json/json-fields';
import { refusalOf } from '../runs/runs-api';

/** Reruns a pull request's flaky checks on GitHub, through Observatory's API. */
export interface RerunApi {
  /** How many workflow runs were started again; fails with the API's own words. */
  rerun(repo: string, number: number): Observable<number>;
}

const RERUN_URL = '/api/rerun';
/** The API accepts writes only with this header, which no other site can add. */
const WRITE_HEADERS = new HttpHeaders({ 'x-observatory': '1' });
const NOT_A_RERUN = 'the site sent something that is not a rerun';

/** The number of workflow runs in a rerun's answer, or null when it is not one. */
export function rerunCountOf(body: unknown): number | null {
  if (!isObject(body) || !Array.isArray(body['runs'])) return null;
  return body['runs'].length;
}

@Injectable({ providedIn: 'root' })
export class HttpRerunApi implements RerunApi {
  private readonly http = inject(HttpClient);

  rerun(repo: string, number: number): Observable<number> {
    return this.http.post<unknown>(RERUN_URL, { repo, number }, { headers: WRITE_HEADERS }).pipe(
      catchError((error: unknown) =>
        throwError(() =>
          error instanceof HttpErrorResponse ? new Error(refusalOf(error)) : error,
        ),
      ),
      map((body) => {
        const count = rerunCountOf(body);
        if (count === null) throw new Error(NOT_A_RERUN);
        return count;
      }),
    );
  }
}

export const RERUN_API = new InjectionToken<RerunApi>('RerunApi', {
  providedIn: 'root',
  factory: () => inject(HttpRerunApi),
});
