import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { InjectionToken, inject } from '@angular/core';
import { Observable, catchError, map, of } from 'rxjs';
import { ISSUE_URL, parseIssueDetail } from '../issues/issue-detail';

/** Where one pull request stands, as `GET /api/pull-state` answers. */
export interface PullState {
  readonly state: 'OPEN' | 'MERGED' | 'CLOSED';
  readonly title: string;
}

/** What a lookup came to. `denied` is a 401 or 403: this viewer may not read it. */
export type Lookup<T> =
  | { readonly status: 'found'; readonly value: T }
  | { readonly status: 'denied' }
  | { readonly status: 'failed' };

/** The two follow-up reads the activity watch makes about what a report changed. */
export interface ActivityLookups {
  pullState(repo: string, number: number): Observable<Lookup<PullState>>;
  issueTitle(repo: string, number: number): Observable<Lookup<string>>;
}

const PULL_STATE_URL = '/api/pull-state';
const PULL_STATES: readonly PullState['state'][] = ['OPEN', 'MERGED', 'CLOSED'];
const DENIED_STATUSES: readonly number[] = [401, 403];

/** The lookups over Observatory's own API. */
export const ACTIVITY_LOOKUPS = new InjectionToken<ActivityLookups>('ActivityLookups', {
  providedIn: 'root',
  factory: () => {
    const http = inject(HttpClient);
    const lookUp = <T>(url: string, repo: string, number: number, parse: Parse<T>) =>
      http.get<unknown>(url, { params: { repo, number } }).pipe(
        map((body) => foundOrFailed(parse(body))),
        catchError((error: unknown) => of(failureOf<T>(error))),
      );
    return {
      pullState: (repo, number) => lookUp(PULL_STATE_URL, repo, number, parsePullState),
      issueTitle: (repo, number) =>
        lookUp(ISSUE_URL, repo, number, (body) => parseIssueDetail(body)?.title ?? null),
    };
  },
});

type Parse<T> = (body: unknown) => T | null;

/** Reads one pull request's state defensively; null when it is not one. */
export function parsePullState(value: unknown): PullState | null {
  if (typeof value !== 'object' || value === null) return null;
  const { state, title } = value as Record<string, unknown>;
  const known = PULL_STATES.find((candidate) => candidate === state);
  return known && typeof title === 'string' ? { state: known, title } : null;
}

const foundOrFailed = <T>(value: T | null): Lookup<T> =>
  value === null ? { status: 'failed' } : { status: 'found', value };

function failureOf<T>(error: unknown): Lookup<T> {
  const isDenied = error instanceof HttpErrorResponse && DENIED_STATUSES.includes(error.status);
  return isDenied ? { status: 'denied' } : { status: 'failed' };
}
