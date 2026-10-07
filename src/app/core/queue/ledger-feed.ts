import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, catchError, map, of } from 'rxjs';
import { Ledger, parseLedger } from './ledger';

const LEDGER_URL = '/api/ledger';

/** One read of `repo`'s ledger, or null when it cannot be read. */
export function readLedger(http: HttpClient, repo: string): Observable<Ledger | null> {
  return http.get<unknown>(LEDGER_URL, { params: { repo } }).pipe(
    map((body) => parseLedger(body)),
    catchError(() => of(null)),
  );
}

/** Reads one repository's ledger. Until it arrives, or if it cannot be read,
 *  there is none and the timeline stays hidden. */
@Injectable()
export class LedgerFeed {
  private readonly http = inject(HttpClient);
  private readonly current = signal<Ledger | null>(null);
  private repo: string | null = null;

  readonly ledger = this.current.asReadonly();

  /** Reads `repo`'s ledger; another repository's is dropped at once. */
  load(repo: string): void {
    if (repo !== this.repo) this.current.set(null);
    this.repo = repo;
    readLedger(this.http, repo).subscribe((ledger) => this.current.set(ledger));
  }
}
