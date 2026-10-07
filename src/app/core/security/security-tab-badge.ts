import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of } from 'rxjs';
import { TabBadge } from '../../shared/project-tabs/tab-badge';
import { SECURITY_URL } from './security-feed';
import { openAlertCount, parseSecurityReport } from './security-report';

/**
 * The open alerts on a project's Security tab. Each screen with the tab strip
 * asks once as it opens; the API keeps the answer for a few minutes, so moving
 * between a project's screens costs GitHub nothing. A failed read shows none.
 */
@Injectable({ providedIn: 'root' })
export class SecurityTabBadge implements TabBadge {
  private readonly http = inject(HttpClient);

  readonly tabId = 'security';
  readonly noun = 'open alert';

  count(repo: string): Observable<number | null> {
    return this.http.get<unknown>(SECURITY_URL, { params: { repo } }).pipe(
      map((body) => {
        const report = parseSecurityReport(body);
        return report ? openAlertCount(report) : null;
      }),
      catchError(() => of(null)),
    );
  }
}
