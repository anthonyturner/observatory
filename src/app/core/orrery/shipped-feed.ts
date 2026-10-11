import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, Subject, catchError, finalize, forkJoin, map, of } from 'rxjs';
import { Ledger, parseLedger } from '../queue/ledger';
import { openDrops } from './merge-arrival';
import { ShippedItem, shippedWork } from './shipped';

const LEDGER_URL = '/api/ledger';

/** The part of a project the feed watches. */
export interface WatchedProject {
  readonly repo: string;
  readonly open: number;
}

/**
 * What every shown project shipped: each one's ledger, read in parallel, so
 * the server's own rules on who may see a repository apply to each. A project
 * whose ledger cannot be read is left out; the rest still show.
 *
 * It also keeps that current. When a project's open pull request count falls,
 * its ledger is read again, and each merge the new read holds that the old one
 * did not is announced on `arrived$`, once. The server keeps a ledger for ten
 * minutes, so a read can still predate the merge; the project then stays owed
 * a re-read at every later observation until a ledger cut after the reading
 * that showed the drop has come back. A drop with no merge behind it (a pull
 * request closed unmerged) announces nothing.
 */
@Injectable()
export class ShippedFeed {
  private readonly http = inject(HttpClient);
  private readonly ledgers = signal<ReadonlyMap<string, Ledger>>(new Map());
  private readonly arrivals = new Subject<ShippedItem>();
  private asked = '';
  private opens: ReadonlyMap<string, number> = new Map();
  /** Projects that lost an open pull request, with when the reading that showed it was cut. */
  private readonly owed = new Map<string, number>();
  private readonly rereading = new Set<string>();

  readonly items = computed(() => shippedWork(this.ledgers()));
  /** A pull request that merged after the page showed its project, in the order seen. */
  readonly arrived$: Observable<ShippedItem> = this.arrivals.asObservable();

  /** Takes in a reading of the projects, cut at `readAt` (ms): reads any ledger not yet read,
   *  and reads again those whose project lost an open pull request. */
  observe(projects: readonly WatchedProject[], readAt: number): void {
    for (const repo of openDrops(this.opens, projects)) {
      this.owed.set(repo, Math.max(readAt, this.owed.get(repo) ?? 0));
    }
    this.opens = new Map(projects.map(({ repo, open }) => [repo, open]));
    this.load(projects.map(({ repo }) => repo));
    for (const [repo, since] of this.owed) {
      if (this.opens.has(repo)) this.reread(repo, since);
      else this.owed.delete(repo);
    }
  }

  private load(repos: readonly string[]): void {
    const key = [...repos].sort().join(' ');
    if (!repos.length || key === this.asked) return;
    this.asked = key;
    forkJoin(repos.map((repo) => this.read(repo).pipe(map((ledger) => [repo, ledger] as const))))
      .pipe(
        map(
          (read) =>
            new Map(read.filter((entry): entry is readonly [string, Ledger] => entry[1] !== null)),
        ),
      )
      .subscribe((ledgers) => this.ledgers.set(ledgers));
  }

  private reread(repo: string, since: number): void {
    if (this.rereading.has(repo)) return;
    this.rereading.add(repo);
    this.read(repo)
      .pipe(finalize(() => this.rereading.delete(repo)))
      .subscribe((ledger) => {
        if (!ledger) return;
        this.take(repo, ledger);
        if (Date.parse(ledger.generatedAt) >= since) this.owed.delete(repo);
      });
  }

  /** Keeps the new ledger and announces what it holds that the last one did not. */
  private take(repo: string, ledger: Ledger): void {
    const before = this.ledgers().get(repo);
    this.ledgers.update((held) => new Map(held).set(repo, ledger));
    if (!before) return;
    const known = new Set(shippedWork(new Map([[repo, before]])).map((item) => item.key));
    for (const item of shippedWork(new Map([[repo, ledger]]))) {
      if (!known.has(item.key)) this.arrivals.next(item);
    }
  }

  private read(repo: string): Observable<Ledger | null> {
    return this.http.get<unknown>(LEDGER_URL, { params: { repo } }).pipe(
      map(parseLedger),
      catchError(() => of(null)),
    );
  }
}
