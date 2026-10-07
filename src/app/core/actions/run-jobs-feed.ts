import { HttpClient } from '@angular/common/http';
import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { Subscription, catchError, map, of } from 'rxjs';
import { RunJobs, parseRunJobs } from './run-jobs';

/** Where the picked run's jobs stand. */
export type RunJobsState =
  | { readonly status: 'idle' }
  | { readonly status: 'reading'; readonly runId: number }
  | { readonly status: 'unreachable'; readonly runId: number }
  | { readonly status: 'ready'; readonly jobs: RunJobs };

const RUN_URL = '/api/actions/run';

/** Reads one run's jobs and steps, for the page that provides it. */
@Injectable()
export class RunJobsFeed {
  private readonly http = inject(HttpClient);
  private readonly current = signal<RunJobsState>({ status: 'idle' });
  private reading: Subscription | null = null;

  readonly state = this.current.asReadonly();

  constructor() {
    inject(DestroyRef).onDestroy(() => this.reading?.unsubscribe());
  }

  /**
   * Reads `runId`'s jobs, in place of any it was reading; none for null.
   * Reading the run on screen again keeps its jobs showing until the answer comes.
   */
  load(repo: string, runId: number | null): void {
    this.reading?.unsubscribe();
    if (runId === null) {
      this.current.set({ status: 'idle' });
      return;
    }
    const now = this.current();
    if (now.status !== 'ready' || now.jobs.runId !== runId) {
      this.current.set({ status: 'reading', runId });
    }
    this.reading = this.http
      .get<unknown>(RUN_URL, { params: { repo, run: String(runId) } })
      .pipe(
        map((body): RunJobsState => {
          const jobs = parseRunJobs(body);
          return jobs ? { status: 'ready', jobs } : { status: 'unreachable', runId };
        }),
        catchError(() => of<RunJobsState>({ status: 'unreachable', runId })),
      )
      .subscribe((state) => this.current.set(state));
  }
}
