import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable, InjectionToken, inject } from '@angular/core';
import { Observable, catchError, map, of } from 'rxjs';

/** Asks this machine's API whether Agent Speak is talking. */
export interface AgentSpeechApi {
  /** True while a line plays unpaused or more are on their way. Any failure
   *  reads as false, so Jev talks rather than wait forever. */
  isBusy(): Observable<boolean>;
}

/** Tells this machine's API that Jev is speaking, so Agent Speak holds its lines. */
export interface JevHoldApi {
  /** Keeps the hold `token` names for a few seconds more. */
  renew(token: string): Observable<void>;
  release(token: string): Observable<void>;
}

const AGENT_SPEECH_URL = '/api/agent-speech';
const JEV_HOLD_URL = '/api/agent-speech/hold';
/** The API answers these only with this header, which no other site can add. */
const OWN_PAGE_HEADERS = new HttpHeaders({ 'x-observatory': '1' });

const isBusyIn = (body: unknown): boolean =>
  typeof body === 'object' && body !== null && Reflect.get(body, 'busy') === true;

const answered = (): void => undefined;
/** A hold that does not reach the server lapses there by itself in a few seconds. */
const unanswered = (): Observable<void> => of(undefined);

@Injectable({ providedIn: 'root' })
export class HttpAgentSpeechApi implements AgentSpeechApi, JevHoldApi {
  private readonly http = inject(HttpClient);

  isBusy(): Observable<boolean> {
    return this.http.get<unknown>(AGENT_SPEECH_URL, { headers: OWN_PAGE_HEADERS }).pipe(
      map(isBusyIn),
      catchError(() => of(false)),
    );
  }

  renew(token: string): Observable<void> {
    return this.http
      .post<unknown>(JEV_HOLD_URL, { token }, { headers: OWN_PAGE_HEADERS })
      .pipe(map(answered), catchError(unanswered));
  }

  release(token: string): Observable<void> {
    const params = new HttpParams({ fromObject: { token } });
    return this.http
      .delete<unknown>(JEV_HOLD_URL, { params, headers: OWN_PAGE_HEADERS })
      .pipe(map(answered), catchError(unanswered));
  }
}

export const AGENT_SPEECH_API = new InjectionToken<AgentSpeechApi>('AgentSpeechApi', {
  providedIn: 'root',
  factory: () => inject(HttpAgentSpeechApi),
});

export const JEV_HOLD_API = new InjectionToken<JevHoldApi>('JevHoldApi', {
  providedIn: 'root',
  factory: () => inject(HttpAgentSpeechApi),
});
