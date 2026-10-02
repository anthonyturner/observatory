import { HttpClient, HttpErrorResponse, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable, InjectionToken, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { parseMailboxReport } from './mail-parse';
import { MailAccount, MailAnswer } from './mail.types';

/** Reads one inbox from Observatory's API: from its cache, or asking the mail server again. */
export interface MailApi {
  read(account: MailAccount): Promise<MailAnswer>;
  refresh(account: MailAccount): Promise<MailAnswer>;
}

const MAIL_URL = '/api/mail';
/** Signed out, refused or not there: the hosted site, which has no mail for anyone. */
const NO_MAIL: ReadonlySet<number> = new Set([401, 403, 404]);
/** The API reads mail only with this header, which no other site can add. */
const OWN_PAGE_HEADERS = new HttpHeaders({ 'x-observatory': '1' });

@Injectable({ providedIn: 'root' })
export class HttpMailApi implements MailApi {
  private readonly http = inject(HttpClient);

  read(account: MailAccount): Promise<MailAnswer> {
    return this.ask(new HttpParams({ fromObject: { account } }));
  }

  refresh(account: MailAccount): Promise<MailAnswer> {
    return this.ask(new HttpParams({ fromObject: { account, refresh: '1' } }));
  }

  private async ask(params: HttpParams): Promise<MailAnswer> {
    let body: unknown;
    try {
      body = await firstValueFrom(
        this.http.get<unknown>(MAIL_URL, { params, headers: OWN_PAGE_HEADERS }),
      );
    } catch (error: unknown) {
      const isAbsent = error instanceof HttpErrorResponse && NO_MAIL.has(error.status);
      return isAbsent ? { kind: 'absent' } : { kind: 'unreachable' };
    }
    const report = parseMailboxReport(body);
    return report ? { kind: 'report', report } : { kind: 'unreachable' };
  }
}

export const MAIL_API = new InjectionToken<MailApi>('MailApi', {
  providedIn: 'root',
  factory: () => inject(HttpMailApi),
});
