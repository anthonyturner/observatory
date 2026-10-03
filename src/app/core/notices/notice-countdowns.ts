import { Signal, signal } from '@angular/core';
import { Subscription, timer } from 'rxjs';
import { Countdown } from './notice.types';
import { resumedMs } from './notice-timing';

/** One notice's countdown. Mutable: only its owner below touches it. */
interface Timer {
  readonly totalMs: number;
  remainingMs: number;
  /** When this run started, or null while it is paused. */
  startedAt: number | null;
  running: Subscription | null;
}

/** What the countdowns need from their owner. */
export interface CountdownHost {
  readonly isPaused: () => boolean;
  readonly expire: (id: number) => void;
  readonly now: () => number;
}

/**
 * The stack's countdowns, one per notice, paused and resumed together. Each
 * keeps the time it has left across a pause, and the line it draws changes
 * only when a run starts, so nothing ticks through the view while it runs.
 */
export class NoticeCountdowns {
  private readonly timers = new Map<number, Timer>();
  private readonly lines = signal<ReadonlyMap<number, Countdown>>(new Map());
  private runs = 0;

  readonly countdowns: Signal<ReadonlyMap<number, Countdown>> = this.lines.asReadonly();

  constructor(private readonly host: CountdownHost) {}

  /** Starts, or starts afresh, a countdown of `totalMs`; it waits if the stack is paused. */
  start(id: number, totalMs: number): void {
    this.stop(id);
    this.timers.set(id, { totalMs, remainingMs: totalMs, startedAt: null, running: null });
    this.draw(id, 1, totalMs);
    if (!this.host.isPaused()) this.run(id);
  }

  stop(id: number): void {
    this.timers.get(id)?.running?.unsubscribe();
    if (!this.timers.delete(id)) return;
    this.lines.update((lines) => {
      const next = new Map(lines);
      next.delete(id);
      return next;
    });
  }

  stopAll(): void {
    for (const id of [...this.timers.keys()]) this.stop(id);
  }

  pause(): void {
    const now = this.host.now();
    for (const timer of this.timers.values()) {
      if (timer.startedAt === null) continue;
      timer.remainingMs -= now - timer.startedAt;
      timer.startedAt = null;
      timer.running?.unsubscribe();
      timer.running = null;
    }
  }

  /** Carries on from the time left, but never with less than a few seconds. */
  resume(): void {
    for (const [id, timer] of this.timers) {
      if (timer.startedAt !== null) continue;
      const left = Math.max(timer.remainingMs, 0);
      timer.remainingMs = resumedMs(left);
      this.draw(id, left / timer.totalMs, timer.remainingMs);
      this.run(id);
    }
  }

  private run(id: number): void {
    const entry = this.timers.get(id);
    if (!entry) return;
    entry.startedAt = this.host.now();
    entry.running = timer(entry.remainingMs).subscribe(() => this.host.expire(id));
  }

  private draw(id: number, fromScale: number, ms: number): void {
    this.runs += 1;
    const countdown: Countdown = { fromScale, ms, run: this.runs };
    this.lines.update((lines) => new Map(lines).set(id, countdown));
  }
}
