import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Injectable, InjectionToken, inject } from '@angular/core';
import { Observable, catchError, map, of } from 'rxjs';
import { isObject, isText } from '../json/json-fields';
import { refusalOf } from '../runs/runs-api';
import { DevServerStatus, DevTarget, STARTING, STOPPED, StartPhase } from './dev-server.types';

/**
 * The local API's dev servers. Only the local site has them; the hosted one
 * answers 404. No call fails: an answer that is an error or not a status reads
 * as a failed server whose reason says what went wrong.
 */
export interface DevServerApi {
  status(target: DevTarget): Observable<DevServerStatus>;
  /** Starts the target's dev server, or returns the one already running. */
  start(target: DevTarget): Observable<DevServerStatus>;
  /** Ends it, and removes a pull request's worktree. */
  stop(target: DevTarget): Observable<DevServerStatus>;
}

const DEV_SERVERS_URL = '/api/dev-servers';
/** The API accepts writes only with this header, which no other site can add. */
const WRITE_HEADERS = new HttpHeaders({ 'x-observatory': '1' });
const NOT_A_STATUS = 'The site sent something that is not a dev server status.';
/** A site is opened by its address, so only a web address will do. */
const WEB_ADDRESS = /^https?:\/\//i;
const UNREACHABLE = 'Observatory’s API could not be reached.';
const PHASES: readonly StartPhase[] = ['fetching', 'installing', 'starting'];

const phaseOf = (value: unknown): StartPhase =>
  PHASES.find((phase) => phase === value) ?? 'starting';

/** The target as a query string reads it. */
const paramsOf = ({ repo, pull }: DevTarget): Record<string, string> =>
  pull === undefined ? { repo } : { repo, pull: String(pull) };

/** The status in an API answer, or null when it is not one. */
export function devServerStatusOf(body: unknown): DevServerStatus | null {
  if (!isObject(body)) return null;
  switch (body['state']) {
    case 'stopped':
      return STOPPED;
    case 'starting':
      return body['phase'] === undefined
        ? STARTING
        : { state: 'starting', phase: phaseOf(body['phase']) };
    case 'running':
      return isText(body['url']) && WEB_ADDRESS.test(body['url'])
        ? { state: 'running', url: body['url'] }
        : null;
    case 'failed':
      return isText(body['reason']) ? { state: 'failed', reason: body['reason'] } : null;
    case 'unavailable':
      return isText(body['reason']) ? { state: 'unavailable', reason: body['reason'] } : null;
    default:
      return null;
  }
}

const failed = (reason: string): DevServerStatus => ({ state: 'failed', reason });

function reasonOf(error: unknown): string {
  if (!(error instanceof HttpErrorResponse)) return UNREACHABLE;
  return error.status === 0 ? UNREACHABLE : refusalOf(error);
}

const asStatus = (answer: Observable<unknown>): Observable<DevServerStatus> =>
  answer.pipe(
    map((body) => devServerStatusOf(body) ?? failed(NOT_A_STATUS)),
    catchError((error: unknown) => of(failed(reasonOf(error)))),
  );

@Injectable({ providedIn: 'root' })
export class HttpDevServerApi implements DevServerApi {
  private readonly http = inject(HttpClient);

  status(target: DevTarget): Observable<DevServerStatus> {
    return asStatus(this.http.get<unknown>(DEV_SERVERS_URL, { params: paramsOf(target) }));
  }

  start(target: DevTarget): Observable<DevServerStatus> {
    return asStatus(this.http.post<unknown>(DEV_SERVERS_URL, target, { headers: WRITE_HEADERS }));
  }

  stop(target: DevTarget): Observable<DevServerStatus> {
    return asStatus(
      this.http.delete<unknown>(DEV_SERVERS_URL, {
        params: paramsOf(target),
        headers: WRITE_HEADERS,
      }),
    );
  }
}

export const DEV_SERVER_API = new InjectionToken<DevServerApi>('DevServerApi', {
  providedIn: 'root',
  factory: () => inject(HttpDevServerApi),
});
