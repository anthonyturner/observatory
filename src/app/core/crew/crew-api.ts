import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Injectable, InjectionToken, inject } from '@angular/core';
import { Observable, catchError, map, of, throwError } from 'rxjs';
import { isNumber, isObject, isText } from '../json/json-fields';
import { RunsApiError, refusalOf } from '../runs/runs-api';
import { StartRequest } from '../runs/runs.types';

/** The local API's crew routes. Only the local site has them; the hosted one answers 404. */
export interface CrewApi {
  /** Whether a crew can be sent from here; false on any failure to say. */
  isAvailable(): Observable<boolean>;
  /** A crew's run for pull request `number`, ready for the runner to start. */
  propose(repo: string, number: number): Observable<StartRequest>;
}

const CREW_URL = '/api/crew';
/** The API accepts writes only with this header, which no other site can add. */
const WRITE_HEADERS = new HttpHeaders({ 'x-observatory': '1' });
const NOT_A_CREW = 'the site sent something that is not a crew';

/** The runner's start request in a crew's answer, or null when it is not one. */
export function startRequestOf(body: unknown): StartRequest | null {
  if (!isObject(body) || !isText(body['prompt']) || !isObject(body['run'])) return null;
  const { token, folder, expiresAt } = body['run'];
  if (!isText(token) || !isText(folder) || !isNumber(expiresAt)) return null;
  return { token, prompt: body['prompt'], folder };
}

@Injectable({ providedIn: 'root' })
export class HttpCrewApi implements CrewApi {
  private readonly http = inject(HttpClient);

  isAvailable(): Observable<boolean> {
    return this.http.get<unknown>(CREW_URL).pipe(
      map((body) => isObject(body) && body['isAvailable'] === true),
      catchError(() => of(false)),
    );
  }

  propose(repo: string, number: number): Observable<StartRequest> {
    return this.http.post<unknown>(CREW_URL, { repo, number }, { headers: WRITE_HEADERS }).pipe(
      catchError((error: unknown) =>
        throwError(() =>
          error instanceof HttpErrorResponse
            ? new RunsApiError(error.status, refusalOf(error))
            : error,
        ),
      ),
      map((body) => {
        const request = startRequestOf(body);
        if (!request) throw new Error(NOT_A_CREW);
        return request;
      }),
    );
  }
}

export const CREW_API = new InjectionToken<CrewApi>('CrewApi', {
  providedIn: 'root',
  factory: () => inject(HttpCrewApi),
});
