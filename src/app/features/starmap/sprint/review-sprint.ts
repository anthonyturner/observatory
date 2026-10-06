import { Injectable, computed, inject, signal } from '@angular/core';
import { Clock } from '../../../core/time/clock';
import { SprintOption, SprintPick } from './sprint-plan';

const MINUTE_MS = 60_000;

/** Choosing a length, the timer running, or the summary of what it cleared. */
export type SprintPhase = 'setup' | 'running' | 'summary';

/** A sprint under way or just finished. */
export interface Sprint {
  readonly picks: readonly SprintPick[];
  readonly startedAt: number;
  readonly endsAt: number;
  /** When it was ended early, or null while it runs its full time. */
  readonly endedAt: number | null;
}

/**
 * A time-boxed review sprint on the review queue: which pull requests it took
 * on, which of them were opened while it ran, and whether it is still running.
 * It ends by itself when its time is up.
 */
@Injectable()
export class ReviewSprint {
  private readonly now = inject(Clock).now;
  private readonly current = signal<Sprint | null>(null);
  private readonly choosing = signal(false);
  private readonly opened = signal<ReadonlySet<number>>(new Set());

  readonly sprint = this.current.asReadonly();
  /** The sprint's pull requests opened while it ran. */
  readonly reviewed = this.opened.asReadonly();
  readonly isRunning = computed(() => {
    const sprint = this.current();
    return !!sprint && sprint.endedAt === null && this.now().getTime() < sprint.endsAt;
  });
  readonly phase = computed((): SprintPhase | null => {
    if (this.isRunning()) return 'running';
    if (this.current()) return 'summary';
    return this.choosing() ? 'setup' : null;
  });
  /** Time left on the clock; zero once it has ended. */
  readonly remainingMs = computed(() => {
    const sprint = this.current();
    if (!sprint || !this.isRunning()) return 0;
    return Math.max(0, sprint.endsAt - this.now().getTime());
  });
  readonly prs = computed(() => this.current()?.picks.map((pick) => pick.pr) ?? []);

  /** Opens the lengths to choose from, or closes them; a sprint on show stays. */
  toggleSetup(): void {
    if (!this.current()) this.choosing.update((open) => !open);
  }

  start(option: SprintOption): void {
    const startedAt = this.now().getTime();
    this.current.set({
      picks: option.picks,
      startedAt,
      endsAt: startedAt + option.minutes * MINUTE_MS,
      endedAt: null,
    });
    this.opened.set(new Set());
    this.choosing.set(false);
  }

  /** Counts a pull request as reviewed when the running sprint holds it. */
  markReviewed(pr: number): void {
    if (!this.isRunning() || !this.prs().includes(pr)) return;
    this.opened.update((prs) => new Set([...prs, pr]));
  }

  /** Ends the sprint early, on to its summary. */
  end(): void {
    if (!this.isRunning()) return;
    this.current.update((sprint) => sprint && { ...sprint, endedAt: this.now().getTime() });
  }

  /** Puts the sprint, its summary or the lengths away. */
  close(): void {
    this.current.set(null);
    this.opened.set(new Set());
    this.choosing.set(false);
  }
}
