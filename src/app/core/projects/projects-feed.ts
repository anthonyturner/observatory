import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, firstValueFrom, interval, map, of, startWith, switchMap } from 'rxjs';
import { ProjectsReport, parseProjectsReport } from './projects-report';

/** Where the projects stand. Only `ready` carries them. */
export type ProjectsState =
  | { readonly status: 'reading' }
  | { readonly status: 'unreachable' }
  | { readonly status: 'ready'; readonly report: ProjectsReport };

/** Observatory's own API, which reads GitHub as the signed-in `gh` account. */
const PROJECTS_URL = '/api/projects';
/** The API reads GitHub at most every five minutes, so asking more often gains nothing. */
const REFRESH_MS = 5 * 60_000;

/** Reads every project's pull-request counts, now and every five minutes. */
@Injectable({ providedIn: 'root' })
export class ProjectsFeed {
  private readonly http = inject(HttpClient);
  private readonly current = signal<ProjectsState>({ status: 'reading' });

  readonly state = this.current.asReadonly();

  constructor() {
    interval(REFRESH_MS)
      .pipe(
        startWith(0),
        switchMap(() => this.fetch()),
        takeUntilDestroyed(),
      )
      .subscribe((state) => this.current.set(state));
  }

  /** Reads them again now, between the regular reads; true when they were read. */
  async readNow(): Promise<boolean> {
    const state = await firstValueFrom(this.fetch());
    this.current.set(state);
    return state.status === 'ready';
  }

  private fetch() {
    return this.http.get<unknown>(PROJECTS_URL).pipe(
      map((body): ProjectsState => {
        const report = parseProjectsReport(body);
        return report ? { status: 'ready', report } : { status: 'unreachable' };
      }),
      catchError(() => of<ProjectsState>({ status: 'unreachable' })),
    );
  }
}
