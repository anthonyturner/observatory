import { HttpClient } from '@angular/common/http';
import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { Subscription, catchError, map, of } from 'rxjs';
import { CommitDiff, parseCommitDiff } from './commit-diff';

/** Where one commit's diff stands. Only `ready` carries it. */
export type CommitDiffState =
  | { readonly status: 'reading' }
  | { readonly status: 'unreachable' }
  | { readonly status: 'ready'; readonly commit: CommitDiff };

const COMMIT_URL = '/api/commit';

/** Reads one commit's diff at a time, for the Commits tab that provides it. */
@Injectable()
export class CommitDiffFeed {
  private readonly http = inject(HttpClient);
  private readonly current = signal<CommitDiffState>({ status: 'reading' });
  private reading: Subscription | null = null;

  readonly state = this.current.asReadonly();

  constructor() {
    inject(DestroyRef).onDestroy(() => this.reading?.unsubscribe());
  }

  /** Reads `repo`'s commit `sha`, in place of any it was reading. */
  load(repo: string, sha: string): void {
    this.reading?.unsubscribe();
    this.current.set({ status: 'reading' });
    this.reading = this.http
      .get<unknown>(COMMIT_URL, { params: { repo, sha } })
      .pipe(
        map(parseCommitDiff),
        catchError(() => of(null)),
      )
      .subscribe((commit) =>
        this.current.set(commit ? { status: 'ready', commit } : { status: 'unreachable' }),
      );
  }
}
