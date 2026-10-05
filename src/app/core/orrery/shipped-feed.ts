import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { catchError, forkJoin, map, of } from 'rxjs';
import { Ledger, parseLedger } from '../queue/ledger';
import { ShippedItem, shippedWork } from './shipped';

const LEDGER_URL = '/api/ledger';

/**
 * What every shown project shipped: each one's ledger, read in parallel, so
 * the server's own rules on who may see a repository apply to each. A project
 * whose ledger cannot be read is left out; the rest still show.
 */
@Injectable()
export class ShippedFeed {
  private readonly http = inject(HttpClient);
  private readonly current = signal<readonly ShippedItem[]>([]);
  private asked = '';

  readonly items = this.current.asReadonly();

  /** Reads the ledgers of `repos`, unless the same set was just asked for. */
  load(repos: readonly string[]): void {
    const key = [...repos].sort().join(' ');
    if (!repos.length || key === this.asked) return;
    this.asked = key;
    forkJoin(
      repos.map((repo) =>
        this.http.get<unknown>(LEDGER_URL, { params: { repo } }).pipe(
          map((body) => [repo, parseLedger(body)] as const),
          catchError(() => of([repo, null] as const)),
        ),
      ),
    )
      .pipe(
        map(
          (read) =>
            new Map(read.filter((entry): entry is readonly [string, Ledger] => entry[1] !== null)),
        ),
      )
      .subscribe((ledgers) => this.current.set(shippedWork(ledgers)));
  }
}
