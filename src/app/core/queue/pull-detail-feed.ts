import { HttpClient } from '@angular/common/http';
import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { Observable, Subscription, catchError, finalize, map, of } from 'rxjs';
import { PullDetail, parsePullDetail } from './pull-detail';

/** Where one pull request's details stand. Only `ready` carries them. */
export type PullDetailState =
  | { readonly status: 'reading' }
  | { readonly status: 'unreachable' }
  | { readonly status: 'ready'; readonly detail: PullDetail };

const PULL_URL = '/api/pull';
/** Asks the API for the pull request anew rather than its cached copy. */
const FRESH = { fresh: '1' };

/** Reads one pull request's details, for the panel or screen that provides it. */
@Injectable()
export class PullDetailFeed {
  private readonly http = inject(HttpClient);
  private readonly current = signal<PullDetailState>({ status: 'reading' });
  private readonly waiting = signal<PullDetail | null>(null);
  private readonly asking = signal(false);
  private target: { repo: string; number: number } | null = null;
  private reading: Subscription | null = null;

  readonly state = this.current.asReadonly();
  /** Details newer than the ones shown, held back until asked for. */
  readonly newer = this.waiting.asReadonly();
  /** A read is on its way. */
  readonly fetching = this.asking.asReadonly();

  constructor() {
    inject(DestroyRef).onDestroy(() => this.reading?.unsubscribe());
  }

  /** Reads `repo`'s pull request `number`, in place of any it was reading. */
  load(repo: string, number: number): void {
    this.target = { repo, number };
    this.waiting.set(null);
    this.current.set({ status: 'reading' });
    this.read({}, (detail) => this.show(detail));
  }

  /**
   * Reads it again from GitHub. Details already shown stay shown and the new
   * ones wait: replacing them would throw away anything half-typed on the
   * Edit tab.
   */
  refresh(): void {
    const shown = this.current();
    if (shown.status !== 'ready') {
      this.read(FRESH, (detail) => this.show(detail));
      return;
    }
    this.read(FRESH, (detail) => {
      if (detail && detail.fetchedAt !== shown.detail.fetchedAt) this.waiting.set(detail);
    });
  }

  /** Shows the details that were held back. */
  showNewer(): void {
    const newer = this.waiting();
    if (!newer) return;
    this.current.set({ status: 'ready', detail: newer });
    this.waiting.set(null);
  }

  private show(detail: PullDetail | null): void {
    this.current.set(detail ? { status: 'ready', detail } : { status: 'unreachable' });
  }

  private read(extra: Record<string, string>, done: (detail: PullDetail | null) => void): void {
    const target = this.target;
    if (!target) return;
    this.reading?.unsubscribe();
    this.asking.set(true);
    this.reading = this.fetch(target, extra)
      .pipe(finalize(() => this.asking.set(false)))
      .subscribe(done);
  }

  private fetch(
    { repo, number }: { repo: string; number: number },
    extra: Record<string, string>,
  ): Observable<PullDetail | null> {
    return this.http.get<unknown>(PULL_URL, { params: { repo, number, ...extra } }).pipe(
      map(parsePullDetail),
      catchError(() => of(null)),
    );
  }
}
