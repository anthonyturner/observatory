import { DestroyRef, Injectable, inject, signal } from '@angular/core';

const TICK_MS = 1000;

/** The current time, as a signal that updates every second. */
@Injectable({ providedIn: 'root' })
export class Clock {
  private readonly current = signal(new Date());

  readonly now = this.current.asReadonly();

  constructor() {
    const timer = setInterval(() => this.current.set(new Date()), TICK_MS);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }
}
