import { HttpClient } from '@angular/common/http';
import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { Subscription, catchError, map, of } from 'rxjs';
import { PullFile, parsePullFile } from './pull-file';

/** Where one file of a pull request stands. Only `ready` carries it. */
export type PullFileFeedState =
  | { readonly status: 'reading' }
  | { readonly status: 'unreachable' }
  | { readonly status: 'ready'; readonly file: PullFile };

/** One file of a pull request at one commit, as the whole-file page asks for it. */
export interface PullFileAsk {
  readonly repo: string;
  readonly number: number;
  readonly sha: string;
  readonly path: string;
}

const PULL_FILE_URL = '/api/pull-file';

/** Reads one file of a pull request at a time, for the page that provides it. */
@Injectable()
export class PullFileFeed {
  private readonly http = inject(HttpClient);
  private readonly current = signal<PullFileFeedState>({ status: 'reading' });
  private reading: Subscription | null = null;

  readonly state = this.current.asReadonly();

  constructor() {
    inject(DestroyRef).onDestroy(() => this.reading?.unsubscribe());
  }

  /** Reads the file asked for, in place of any it was reading. */
  load(ask: PullFileAsk): void {
    this.reading?.unsubscribe();
    this.current.set({ status: 'reading' });
    this.reading = this.http
      .get<unknown>(PULL_FILE_URL, { params: { ...ask } })
      .pipe(
        map(parsePullFile),
        catchError(() => of(null)),
      )
      .subscribe((file) =>
        this.current.set(file ? { status: 'ready', file } : { status: 'unreachable' }),
      );
  }
}
