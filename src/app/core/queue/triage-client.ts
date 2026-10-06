import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

export type TriageAction = 'seen' | 'unseen' | 'dismiss' | 'snooze' | 'restore' | 'look';

/** A triage action, for a snooze how many days, and for a look the head that was shown. */
export interface TriageChoice {
  readonly action: TriageAction;
  readonly days?: number;
  readonly sha?: string;
}

const TRIAGE_URL = '/api/triage';
/** The API accepts writes only with this header, which no other site can add. */
const WRITE_HEADERS = new HttpHeaders({ 'x-observatory': '1' });

/** Records triage on this machine through Observatory's API; nothing reaches GitHub. */
@Injectable({ providedIn: 'root' })
export class TriageClient {
  private readonly http = inject(HttpClient);

  record(repo: string, number: number, choice: TriageChoice): Observable<unknown> {
    return this.http.post(TRIAGE_URL, { repo, number, ...choice }, { headers: WRITE_HEADERS });
  }
}
