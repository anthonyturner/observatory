import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, Subscription, of, startWith, switchMap, takeWhile, timer } from 'rxjs';
import { DEV_SERVER_API } from './dev-server-api';
import { DevServerStatus, STARTING, STOPPED } from './dev-server.types';
import { PREVIEW_TABS, PreviewTab } from './preview-tab';

/** How often a starting server is asked whether it has an address yet. */
export const STATUS_POLL_MS = 1000;

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

  /** Shows each status of `first` and, while it is starting, of the polls after it; then lands `tab`. */
  private follow(first: Observable<DevServerStatus>, tab: PreviewTab | null): void {
    this.following?.unsubscribe();
    this.waitingTab?.close();
    this.waitingTab = tab;
    this.following = first
      .pipe(
        switchMap((status) =>
          status.state === 'starting' ? this.untilSettled(status) : of(status),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (status) => this.current.set(status),
        complete: () => this.land(tab),
      });
  }

  private untilSettled(starting: DevServerStatus): Observable<DevServerStatus> {
    return timer(STATUS_POLL_MS, STATUS_POLL_MS).pipe(
      switchMap(() => this.api.status(this.repo)),
      startWith(starting),
      takeWhile((status) => status.state === 'starting', true),
    );
  }

  private land(tab: PreviewTab | null): void {
    if (!tab) return;
    this.waitingTab = null;
    const status = this.current();
    if (status.state === 'running') tab.show(status.url);
    else tab.close();
  }
}
