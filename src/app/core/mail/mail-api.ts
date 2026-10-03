import { HttpClient, HttpErrorResponse, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable, InjectionToken, inject } from '@angular/core';
import { Observable, catchError, map, of } from 'rxjs';
import { parseMailboxReport } from './mail-parse';
import { MailAccount, MailAnswer } from './mail.types';

/** Reads one inbox from Observatory's API: from its cache, or asking the mail server again. */
export interface MailApi {
  read(account: MailAccount): Observable<MailAnswer>;
  refresh(account: MailAccount): Observable<MailAnswer>;
}

const MAIL_URL = '/api/mail';
/** Signed out, refused or not there: the hosted site, which has no mail for anyone. */
const NO_MAIL: ReadonlySet<number> = new Set([401, 403, 404]);
/** The API reads mail only with this header, which no other site can add. */
const OWN_PAGE_HEADERS = new HttpHeaders({ 'x-observatory': '1' });

@Injectable({ providedIn: 'root' })
export class HttpMailApi implements MailApi {
  private readonly http = inject(HttpClient);

  read(account: MailAccount): Observable<MailAnswer> {
    return this.ask(new HttpParams({ fromObject: { account } }));
  }

  refresh(account: MailAccount): Observable<MailAnswer> {
    return this.ask(new HttpParams({ fromObject: { account, refresh: '1' } }));
  }

  private ask(params: HttpParams): Observable<MailAnswer> {
    return this.http.get<unknown>(MAIL_URL, { params, headers: OWN_PAGE_HEADERS }).pipe(
      map((body): MailAnswer => {
        const report = parseMailboxReport(body);
        return report ? { kind: 'report', report } : { kind: 'unreachable' };
      }),
      catchError((error: unknown) => {
        const isAbsent = error instanceof HttpErrorResponse && NO_MAIL.has(error.status);
        return of<MailAnswer>(isAbsent ? { kind: 'absent' } : { kind: 'unreachable' });
      }),
    );
  }
}

export const MAIL_API = new InjectionToken<MailApi>('MailApi', {
  providedIn: 'root',
  factory: () => inject(HttpMailApi),
});
