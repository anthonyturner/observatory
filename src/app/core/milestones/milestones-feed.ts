import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { Subscription, catchError, map, of } from 'rxjs';
import { MILESTONES_URL } from './milestones-presence';
import { MilestonesReport, parseMilestonesReport } from './milestones-report';

/** Where one repository's milestones stand. Only `ready` carries them. */
export type MilestonesState =
  | { readonly status: 'reading' }
  | { readonly status: 'unreachable' }
  | { readonly status: 'missing' }
  | { readonly status: 'ready'; readonly report: MilestonesReport };

const HTTP_NOT_FOUND = 404;
/** Past the API's cache, straight to GitHub. */
const FRESH: Readonly<Record<string, string>> = { fresh: '1' };

/** Reads one repository's milestones and discussions for the page that provides it. They move
 *  a few times a day, so it reads once per repository, and again, from GitHub, on `refresh`. */
@Injectable()
export class MilestonesFeed {
  private readonly http = inject(HttpClient);
  private readonly current = signal<MilestonesState>({ status: 'reading' });
  private reading: Subscription | null = null;
  private repo = '';

  readonly state = this.current.asReadonly();

  constructor() {
    inject(DestroyRef).onDestroy(() => this.reading?.unsubscribe());
  }

  /** Reads `repo`'s milestones, in place of any it was reading. */
  load(repo: string): void {
    this.repo = repo;
    this.current.set({ status: 'reading' });
    this.read({ repo });
  }

  /** Asks GitHub again; what is on screen stays meanwhile. */
  refresh(): void {
    if (this.repo) this.read({ repo: this.repo, ...FRESH });
  }

  private read(params: Readonly<Record<string, string>>): void {
    this.reading?.unsubscribe();
    this.reading = this.http
      .get<unknown>(MILESTONES_URL, { params })
      .pipe(
        map((body): MilestonesState => {
          const report = parseMilestonesReport(body);
          return report ? { status: 'ready', report } : { status: 'unreachable' };
        }),
        catchError((error: unknown) =>
          of<MilestonesState>(
            error instanceof HttpErrorResponse && error.status === HTTP_NOT_FOUND
              ? { status: 'missing' }
              : { status: 'unreachable' },
          ),
        ),
      )
      .subscribe((state) => this.settle(state));
  }

  /** A later read that fails keeps the milestones already on screen rather than blanking them. */
  private settle(state: MilestonesState): void {
    if (state.status === 'unreachable' && this.current().status === 'ready') return;
    this.current.set(state);
  }
}
