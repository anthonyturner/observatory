import { DestroyRef, Injectable, Signal, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { EMPTY, Observable, Subscription, expand, switchMap, timer } from 'rxjs';
import { DEV_SERVER_API, DevServerApi } from './dev-server-api';
import { CHECKING, DevServerStatus, STARTING } from './dev-server.types';
import { SITE_OPENER, SiteOpener } from './site-opener';

/** How often a starting server is asked whether its site is up yet. */
export const STATUS_POLL_MS = 1000;
/** How often a running one is asked whether it is still there. */
export const RUNNING_POLL_MS = 10_000;

interface RunPreviewDeps {
  readonly api: DevServerApi;
  readonly opener: SiteOpener;
  readonly destroyRef: DestroyRef;
}

/**
 * One project's dev server as the buttons showing it need it: what it is doing
 * now, Run, which opens the site in a new tab once the server reports it is up,
 * and Stop. Every button for the project shares one, so a Run started on one
 * screen carries on, and opens the site once, after the button that started it
 * is gone.
 */
export interface RunPreview {
  readonly status: Signal<DevServerStatus>;
  /** Whether the browser blocked the tab that was to open the running site. */
  readonly isTabBlocked: Signal<boolean>;
  watch(): () => void;
  /** Starts the server, or finds it running, and opens its site once it is up. */
  run(): void;
  stop(): void;
  /** The owner opened the site by hand, so a note about the blocked tab has done its job. */
  siteOpenedByHand(): void;
}

/** A read only shows where the server stands; Run and Stop are requests that need an answer. */
type Follow = 'read' | 'run' | 'stop';

class RunState implements RunPreview {
  private readonly current = signal<DevServerStatus>(CHECKING);
  private readonly blocked = signal(false);
  private following: Subscription | null = null;
  private watchers = 0;
  /** Whether the site is to be opened when the server being followed first reports running. */
  private opensSite = false;
  /** Whether a Run or Stop has been sent and not yet answered. */
  private pending = false;

  readonly status = this.current.asReadonly();
  readonly isTabBlocked = this.blocked.asReadonly();

  constructor(
    private readonly repo: string,
    private readonly deps: RunPreviewDeps,
  ) {}

  watch(): () => void {
    this.watchers++;
    if (!this.isFollowing()) this.follow(this.deps.api.status(this.repo), 'read');
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.watchers--;
      if (!this.isWanted(this.current())) this.unfollow();
    };
  }

  run(): void {
    this.current.set(STARTING);
    this.blocked.set(false);
    this.follow(this.deps.api.start(this.repo), 'run');
  }

  siteOpenedByHand(): void {
    this.blocked.set(false);
  }

  stop(): void {
    this.blocked.set(false);
    this.follow(this.deps.api.stop(this.repo), 'stop');
  }

  /**
   * Shows `first` and then each poll after it, quickly while the server starts and slowly
   * while it runs, so one that dies shows Run again. The polling ends at a status that is
   * not alive, or that nothing is showing. For a Run, the site opens at the first status
   * that is not starting.
   */
  private follow(first: Observable<DevServerStatus>, kind: Follow): void {
    this.unfollow();
    this.opensSite = kind === 'run';
    this.pending = kind !== 'read';
    this.following = first
      .pipe(
        expand((status) => this.pollAfter(status)),
        takeUntilDestroyed(this.deps.destroyRef),
      )
      .subscribe((status) => {
        this.pending = false;
        this.current.set(status);
        if (status.state !== 'running') this.blocked.set(false);
        this.openIfAsked(status);
      });
  }

  private unfollow(): void {
    this.following?.unsubscribe();
    this.following = null;
  }

  private isFollowing(): boolean {
    return this.following !== null && !this.following.closed;
  }

  /** A request in flight and a server that is starting are followed to the end, shown or not. */
  private isWanted(status: DevServerStatus): boolean {
    return this.watchers > 0 || this.pending || status.state === 'starting';
  }

  private pollAfter(status: DevServerStatus): Observable<DevServerStatus> {
    if (!this.isWanted(status)) return EMPTY;
    if (status.state === 'starting') return this.askIn(STATUS_POLL_MS);
    if (status.state === 'running') return this.askIn(RUNNING_POLL_MS);
    return EMPTY;
  }

  private askIn(ms: number): Observable<DevServerStatus> {
    return timer(ms).pipe(switchMap(() => this.deps.api.status(this.repo)));
  }

  private openIfAsked(status: DevServerStatus): void {
    if (!this.opensSite || status.state === 'starting') return;
    this.opensSite = false;
    if (status.state === 'running') this.blocked.set(!this.deps.opener.open(status.url));
  }
}

/** Every project's Run state, kept for the life of the app and keyed by `owner/name`. */
@Injectable({ providedIn: 'root' })
export class RunPreviews {
  private readonly deps: RunPreviewDeps = {
    api: inject(DEV_SERVER_API),
    opener: inject(SITE_OPENER),
    destroyRef: inject(DestroyRef),
  };
  private readonly byRepo = new Map<string, RunPreview>();

  runFor(repo: string): RunPreview {
    let preview = this.byRepo.get(repo);
    if (!preview) {
      preview = new RunState(repo, this.deps);
      this.byRepo.set(repo, preview);
    }
    return preview;
  }
}
