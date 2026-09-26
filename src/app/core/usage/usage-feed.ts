import { Injectable, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { interval, startWith, switchMap } from 'rxjs';
import { USAGE_READ, UsageState } from './usage-reader';

const REFRESH_MS = 60_000;

/** Reads Claude Code usage from Observatory's API, now and every minute. */
@Injectable({ providedIn: 'root' })
export class UsageFeed {
  private readonly read = inject(USAGE_READ);
  private readonly current = signal<UsageState>({ status: 'reading' });

  readonly state = this.current.asReadonly();

  constructor() {
    interval(REFRESH_MS)
      .pipe(
        startWith(0),
        switchMap(() => this.read()),
        takeUntilDestroyed(),
      )
      .subscribe((state) => this.current.set(state));
  }
}
