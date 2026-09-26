import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { DOCUMENT, Injectable, InjectionToken, inject } from '@angular/core';
import { Observable, firstValueFrom } from 'rxjs';
import { isObject, isText } from '../json/json-fields';
import { readLines } from './ndjson-lines';
import { parseRunEvent, parseRunSummary, parseRunsReport } from './runs-parse';
import { RunEvent, RunSummary, RunsReport, StartRequest } from './runs.types';

/** Called with each event of a followed run, parsed and as the line it came in. */
export type RunEventListener = (event: RunEvent, line: string) => void;

/** The local runner. Only the local site has one; the hosted site answers 404. */
export interface RunsApi {
  list(): Promise<RunsReport>;
  start(request: StartRequest): Promise<RunSummary>;
  cancel(id: string): Promise<RunSummary>;
  /** Calls `onEvent` with each event of run `id` from number `from` on, as it
   *  arrives. Settles when the stream ends, whether the run ended or the
   *  connection dropped: the events say which. */
  follow(id: string, from: number, onEvent: RunEventListener, signal?: AbortSignal): Promise<void>;
}

/** The runner refused or failed a request; `status` says how. */
export class RunsApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** The runner's answers the page treats apart from any other failure. */
export const RUNS_REFUSED = 403;
export const RUN_UNKNOWN = 404;
export const RUNNER_BUSY = 409;

/** The status the runner answered `error` with, or null when it never answered. */
export const statusOf = (error: unknown): number | null =>
  error instanceof RunsApiError ? error.status : null;

/** A streamed GET, as `fetch` makes it: HttpClient cannot hand over a body
 *  while it is still arriving. */
export type StreamFetch = (url: string, init: RequestInit) => Promise<Response>;

export const STREAM_FETCH = new InjectionToken<StreamFetch>('StreamFetch', {
  providedIn: 'root',
  factory: () => {
    const view = inject(DOCUMENT).defaultView;
    return (url, init) =>
      view ? view.fetch(url, init) : Promise.reject(new Error('No fetch here'));
  },
});

const RUNS_URL = '/api/runs';
/** The API accepts writes only with this header, which no other site can add. */
const WRITE_HEADERS = new HttpHeaders({ 'x-observatory': '1' });
/** What an answer that is not a run reads as. */
const NOT_A_RUN = 'the site sent something that is not a run';

const runUrl = (id: string): string => `${RUNS_URL}?id=${encodeURIComponent(id)}`;

/** The runner behind Observatory's own local API. */
@Injectable({ providedIn: 'root' })
export class HttpRunsApi implements RunsApi {
  private readonly http = inject(HttpClient);
  private readonly fetch = inject(STREAM_FETCH);

  list(): Promise<RunsReport> {
    return answerOf(this.http.get<unknown>(RUNS_URL), parseRunsReport);
  }

  start(request: StartRequest): Promise<RunSummary> {
    const answer = this.http.post<unknown>(RUNS_URL, request, { headers: WRITE_HEADERS });
    return answerOf(answer, parseRunSummary);
  }

  cancel(id: string): Promise<RunSummary> {
    return answerOf(
      this.http.delete<unknown>(runUrl(id), { headers: WRITE_HEADERS }),
      parseRunSummary,
    );
  }

  async follow(
    id: string,
    from: number,
    onEvent: RunEventListener,
    signal?: AbortSignal,
  ): Promise<void> {
    const response = await this.fetch(`${runUrl(id)}&from=${from}`, {
      credentials: 'same-origin',
      signal,
    });
    if (!response.ok || !response.body) {
      throw new RunsApiError(response.status, `HTTP ${response.status}`);
    }
    await readLines(response.body, (line) => {
      const event = parseRunEvent(line);
      if (event) onEvent(event, line);
    });
  }
}

/** The runner's own words for a refusal, else the status. */
function refusalOf(error: HttpErrorResponse): string {
  const body: unknown = error.error;
  return isObject(body) && isText(body['error']) ? body['error'] : `HTTP ${error.status}`;
}

async function answerOf<T>(
  answer: Observable<unknown>,
  parse: (body: unknown) => T | null,
): Promise<T> {
  let body: unknown;
  try {
    body = await firstValueFrom(answer);
  } catch (error: unknown) {
    if (error instanceof HttpErrorResponse) throw new RunsApiError(error.status, refusalOf(error));
    throw error;
  }
  const parsed = parse(body);
  if (parsed === null) throw new Error(NOT_A_RUN);
  return parsed;
}

/** Any error's words, for a note that says what went wrong. */
export const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

export const RUNS_API = new InjectionToken<RunsApi>('RunsApi', {
  providedIn: 'root',
  factory: () => inject(HttpRunsApi),
});
