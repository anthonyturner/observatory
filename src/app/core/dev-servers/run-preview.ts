import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { EMPTY, Observable, Subscription, expand, switchMap, timer } from 'rxjs';
import { DEV_SERVER_API } from './dev-server-api';
import { DevServerStatus, STARTING, STOPPED } from './dev-server.types';
import { PREVIEW_TABS, PreviewTab } from './preview-tab';

/** How often a starting server is asked whether it has an address yet. */
export const STATUS_POLL_MS = 1000;
/** How often a running one is asked whether it is still there. */
export const RUNNING_POLL_MS = 10_000;

/**
 * One project's dev server as a button needs it: what it is doing now, and
 * Run, which opens the site in a new tab once the server reports its address,
 * and Stop. Provide it per button; it follows one project at a time.
 */
@Injectable()
export class RunPreview {
  private readonly api = inject(DEV_SERVER_API);
  private readonly tabs = inject(PREVIEW_TABS);
  private readonly destroyRef = inject(DestroyRef);
  private readonly current = signal<DevServerStatus>(STOPPED);
  private repo = '';
  private following: Subscription | null = null;
  private waitingTab: PreviewTab | null = null;

  readonly status = this.current.asReadonly();

  /** Reads where `repo`'s server stands, for a page that opens on one already running. */
  watch(repo: string): void {
    this.repo = repo;
    this.current.set(STOPPED);
    this.follow(this.api.status(repo), null);
  }

  /** Starts the server, or finds it running, and opens its site when it is up. */
  run(): void {
    const tab = this.tabs.open();
    this.current.set(STARTING);
    this.follow(this.api.start(this.repo), tab);
  }

  stop(): void {
    this.follow(this.api.stop(this.repo), null);
  }

  /**
   * Shows `first` and then each poll after it, quickly while the server starts and slowly
   * while it runs, so one that dies shows Run again. Lands `tab` at the first status that is
   * not starting; the polling ends at one that is not alive.
   */
  private follow(first: Observable<DevServerStatus>, tab: PreviewTab | null): void {
    this.following?.unsubscribe();
    this.waitingTab?.close();
    this.waitingTab = tab;
    this.following = first
      .pipe(
        expand((status) => this.pollAfter(status)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (status) => {
          this.current.set(status);
          this.land(status);
        },
        complete: () => this.land(null),
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

  /** Points the waiting tab at the site once it is up, or closes it once it will not be; with no
   *  status, closes it for a follow that ended first. */
  private land(status: DevServerStatus | null): void {
    const tab = this.waitingTab;
    if (!tab || status?.state === 'starting') return;
    this.waitingTab = null;
    if (status?.state === 'running') tab.show(status.url);
    else tab.close();
  }
}
