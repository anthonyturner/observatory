import { HttpClient } from '@angular/common/http';
import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { Subscription, catchError, map, of } from 'rxjs';
import { SinceLookDiff, parseSinceLookDiff } from './since-look';

/** Where the changes since the last look stand. Only `ready` carries them. */
export type SinceLookState =
  | { readonly status: 'idle' }
  | { readonly status: 'reading' }
  | { readonly status: 'unreachable' }
  | { readonly status: 'ready'; readonly since: SinceLookDiff };

const SINCE_LOOK_URL = '/api/since-look';

/** Reads what changed between the head last looked at and the head now, for
 *  the Diff tab that provides it. */
@Injectable()
export class SinceLookFeed {
  private readonly http = inject(HttpClient);
  private readonly current = signal<SinceLookState>({ status: 'idle' });
  private reading: Subscription | null = null;

  readonly state = this.current.asReadonly();

  constructor() {
    inject(DestroyRef).onDestroy(() => this.reading?.unsubscribe());
  }

  /** Reads `repo`'s changes from `base` to `head`, in place of any it was reading. */
  load(repo: string, base: string, head: string): void {
    this.reading?.unsubscribe();
    this.current.set({ status: 'reading' });
    this.reading = this.http
      .get<unknown>(SINCE_LOOK_URL, { params: { repo, base, head } })
      .pipe(
        map(parseSinceLookDiff),
        catchError(() => of(null)),
      )
      .subscribe((since) =>
        this.current.set(since ? { status: 'ready', since } : { status: 'unreachable' }),
      );
  }

  /** Nothing to read: the head has not moved, or was never looked at. */
  clear(): void {
    this.reading?.unsubscribe();
    this.current.set({ status: 'idle' });
  }
}
