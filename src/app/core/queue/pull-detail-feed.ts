import { HttpClient } from '@angular/common/http';
import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { Subscription, catchError, map, of } from 'rxjs';
import { PullDetail, parsePullDetail } from './pull-detail';

/** Where one pull request's details stand. Only `ready` carries them. */
export type PullDetailState =
  | { readonly status: 'reading' }
  | { readonly status: 'unreachable' }
  | { readonly status: 'ready'; readonly detail: PullDetail };

const PULL_URL = '/api/pull';

/** Reads one pull request's details, for the panel that provides it. */
@Injectable()
export class PullDetailFeed {
  private readonly http = inject(HttpClient);
  private readonly current = signal<PullDetailState>({ status: 'reading' });
  private reading: Subscription | null = null;

  readonly state = this.current.asReadonly();

  constructor() {
    inject(DestroyRef).onDestroy(() => this.reading?.unsubscribe());
  }

  /** Reads `repo`'s pull request `number`, in place of any it was reading. */
  load(repo: string, number: number): void {
    this.reading?.unsubscribe();
    this.current.set({ status: 'reading' });
    this.reading = this.http
      .get<unknown>(PULL_URL, { params: { repo, number } })
      .pipe(
        map((body): PullDetailState => {
          const detail = parsePullDetail(body);
          return detail ? { status: 'ready', detail } : { status: 'unreachable' };
        }),
        catchError(() => of<PullDetailState>({ status: 'unreachable' })),
      )
      .subscribe((state) => this.current.set(state));
  }
}
