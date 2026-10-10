import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { EMPTY, Observable, Subscription, expand, switchMap, timer } from 'rxjs';
import { DEV_SERVER_API } from './dev-server-api';
import { DevServerStatus, STARTING, STOPPED } from './dev-server.types';
import { SITE_OPENER } from './site-opener';

/** How often a starting server is asked whether its site is up yet. */
export const STATUS_POLL_MS = 1000;
/** How often a running one is asked whether it is still there. */
export const RUNNING_POLL_MS = 10_000;

/**
 * One project's dev server as a button needs it: what it is doing now, and
 * Run, which opens the site in a new tab once the server reports it is up,
 * and Stop. Provide it per button; it follows one project at a time.
 */
@Injectable()
export class RunPreview {
  private readonly api = inject(DEV_SERVER_API);
  private readonly opener = inject(SITE_OPENER);
  private readonly destroyRef = inject(DestroyRef);
  private readonly current = signal<DevServerStatus>(STOPPED);
  private readonly blocked = signal(false);
  private repo = '';
  private following: Subscription | null = null;
  /** Whether the site is to be opened when the server being followed first reports running. */
  private opensSite = false;

  readonly status = this.current.asReadonly();
  /** Whether the browser blocked the tab that was to open the running site. */
  readonly isTabBlocked = this.blocked.asReadonly();

  /** Reads where `repo`'s server stands, for a page that opens on one already running. */
  watch(repo: string): void {
    this.repo = repo;
    this.current.set(STOPPED);
    this.follow(this.api.status(repo), false);
  }

  /** Starts the server, or finds it running, and opens its site once it is up. */
  run(): void {
    this.current.set(STARTING);
    this.follow(this.api.start(this.repo), true);
  }

  stop(): void {
    this.follow(this.api.stop(this.repo), false);
  }

  /**
   * Shows `first` and then each poll after it, quickly while the server starts and slowly
   * while it runs, so one that dies shows Run again. The polling ends at a status that is
   * not alive. When `opensSite`, the site opens at the first status that is not starting.
   */
  private follow(first: Observable<DevServerStatus>, opensSite: boolean): void {
    this.following?.unsubscribe();
    this.opensSite = opensSite;
    this.blocked.set(false);
    this.following = first
      .pipe(
        expand((status) => this.pollAfter(status)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((status) => {
        this.current.set(status);
        this.openIfAsked(status);
      });
  }

  private pollAfter(status: DevServerStatus): Observable<DevServerStatus> {
    if (status.state === 'starting') return this.askIn(STATUS_POLL_MS);
    if (status.state === 'running') return this.askIn(RUNNING_POLL_MS);
    return EMPTY;
  }

  private askIn(ms: number): Observable<DevServerStatus> {
    return timer(ms).pipe(switchMap(() => this.api.status(this.repo)));
  }

  private openIfAsked(status: DevServerStatus): void {
    if (!this.opensSite || status.state === 'starting') return;
    this.opensSite = false;
    if (status.state === 'running') this.blocked.set(!this.opener.open(status.url));
  }
}
