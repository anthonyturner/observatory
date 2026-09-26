import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Injectable, InjectionToken, inject } from '@angular/core';
import { Observable, firstValueFrom } from 'rxjs';
import { AssistantStatus, RouteReply, RouteRequest } from './assistant.types';
import { parseAssistantStatus, parseRouteReply } from './route-parse';

/** The router: what it offers, and what it makes of one request. Both reject
 *  when the site does not answer, or answers with something else. */
export interface AssistantApi {
  status(): Promise<AssistantStatus>;
  route(request: RouteRequest): Promise<RouteReply>;
}

/** The site answered, but not with what the router sends. */
class UnreadableAnswer extends Error {}

/** The router is not this viewer's: a visitor to the hosted preview. */
export class AssistantRefused extends Error {}

const ROUTE_URL = '/api/route';
const HTTP_FORBIDDEN = 403;
/** The API accepts writes only with this header, which no other site can add. */
const WRITE_HEADERS = new HttpHeaders({ 'x-observatory': '1' });

/** The router behind Observatory's own API. */
@Injectable({ providedIn: 'root' })
export class HttpAssistantApi implements AssistantApi {
  private readonly http = inject(HttpClient);

  status(): Promise<AssistantStatus> {
    return answerOf(this.http.get<unknown>(ROUTE_URL), parseAssistantStatus);
  }

  route(request: RouteRequest): Promise<RouteReply> {
    return answerOf(
      this.http.post<unknown>(ROUTE_URL, request, { headers: WRITE_HEADERS }),
      parseRouteReply,
    );
  }
}

async function answerOf<T>(
  answer: Observable<unknown>,
  parse: (body: unknown) => T | null,
): Promise<T> {
  let body: unknown;
  try {
    body = await firstValueFrom(answer);
  } catch (error: unknown) {
    if (error instanceof HttpErrorResponse && error.status === HTTP_FORBIDDEN) {
      throw new AssistantRefused(`${ROUTE_URL} is the owner's`);
    }
    throw error;
  }
  const parsed = parse(body);
  if (parsed === null) throw new UnreadableAnswer(`Not an answer from ${ROUTE_URL}`);
  return parsed;
}

export const ASSISTANT_API = new InjectionToken<AssistantApi>('AssistantApi', {
  providedIn: 'root',
  factory: () => inject(HttpAssistantApi),
});
