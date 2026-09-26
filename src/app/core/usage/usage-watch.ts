import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription, finalize, switchMap, timer } from 'rxjs';
import { USAGE_READ, UsageState } from './usage-reader';

/** How often the usage is read again while it is on screen. The API rebuilds
 *  it from the session logs on each read, so not every few seconds. */
export const USAGE_WATCH_MS = 60_000;

/** A failed read keeps the readings already shown, as pr-starmap's page does:
 *  the screen says unknown only when it never had any. */
export function keepReadings(previous: UsageState, next: UsageState): UsageState {
  return next.status !== 'ready' && previous.status === 'ready' ? previous : next;
}

/** Reads Claude Code usage only while a screen watches it: now, then every
 *  minute until it stops. What was read stays for the next time it starts. */
@Injectable()
export class UsageWatch {
  private readonly read = inject(USAGE_READ);
  private readonly destroyRef = inject(DestroyRef);
  private readonly current = signal<UsageState>({ status: 'reading' });
  private readonly refreshingNow = signal(false);
  private polling: Subscription | null = null;

  readonly state = this.current.asReadonly();
  readonly isRefreshing = this.refreshingNow.asReadonly();

  start(): void {
    if (this.polling) return;
    this.polling = timer(0, USAGE_WATCH_MS)
      .pipe(
        switchMap(() => this.read()),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((state) => this.take(state));
  }

  stop(): void {
    this.polling?.unsubscribe();
    this.polling = null;
  }

  /** Reads it again now, for the Refresh button. */
  refresh(): void {
    this.refreshingNow.set(true);
    this.read()
      .pipe(
        finalize(() => this.refreshingNow.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((state) => this.take(state));
  }

  private take(state: UsageState): void {
    this.current.update((previous) => keepReadings(previous, state));
  }
}
