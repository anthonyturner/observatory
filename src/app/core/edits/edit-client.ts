import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { LabelLine, listOf, parseLabel } from '../queue/pull-detail-parts';
import { EditChanges, EditRecord, parseEditRecord } from './edit-record';

const EDIT_URL = '/api/edit';
const CLEAR_URL = '/api/edit/clear';
const LABELS_URL = '/api/labels';
/** The API accepts writes only with this header, which no other site can add. */
const WRITE_HEADERS = new HttpHeaders({ 'x-observatory': '1' });

/** Changes pull requests on GitHub through Observatory's API, which applies them at once. */
@Injectable({ providedIn: 'root' })
export class EditClient {
  private readonly http = inject(HttpClient);

  /** How the last edit of this pull request went, or null. */
  record(repo: string, number: number): Observable<EditRecord | null> {
    return this.http
      .get<unknown>(EDIT_URL, { params: { repo, number } })
      .pipe(map(parseEditRecord));
  }

  /** Applies `changes` and answers how it went. */
  apply(repo: string, number: number, changes: EditChanges): Observable<EditRecord | null> {
    return this.http
      .post<unknown>(EDIT_URL, { repo, number, changes }, { headers: WRITE_HEADERS })
      .pipe(map(parseEditRecord));
  }

  clear(repo: string, number: number): Observable<unknown> {
    return this.http.post(CLEAR_URL, { repo, number }, { headers: WRITE_HEADERS });
  }

  /** The labels a repository has: the only ones an edit may pick. */
  labels(repo: string): Observable<LabelLine[]> {
    return this.http
      .get<unknown>(LABELS_URL, { params: { repo } })
      .pipe(map((body) => listOf(body, parseLabel)));
  }
}
