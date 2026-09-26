import { RUN_UNKNOWN, RunEventListener, RunsApi, statusOf } from './runs-api';
import { RunEvent } from './runs.types';

/** How many times a dropped stream is picked up again before giving up. */
export const RECONNECTS = 3;
/** The wait before the first reconnect; each one after waits twice as long. */
export const FIRST_RETRY_MS = 1000;

/** What a follower tells the run it follows. */
export interface FollowListener {
  readonly event: RunEventListener;
  /** The stream dropped before the run ended, and will be tried again. */
  reconnecting(): void;
  /** It dropped `RECONNECTS` times running; only `reconnect()` tries again. */
  lost(): void;
  /** The runner no longer knows the run: it restarted, and took the run with it. */
  gone(): void;
  /** Whether the run has ended, so a closed stream is the end, not a drop. */
  hasEnded(): boolean;
}

/** Where a follower starts, and what it reports to. */
export interface FollowPlan {
  readonly id: string;
  /** The first event not yet seen. */
  readonly from: number;
  readonly listener: FollowListener;
}

/**
 * Follows one run's stream from the first event not yet seen. A stream that
 * closes before the run has ended was dropped, and is picked up again from
 * where it stopped, further apart each time.
 */
export class RunFollower {
  private next: number;
  private tries = 0;
  private control: AbortController | null = null;
  private retry: ReturnType<typeof setTimeout> | undefined;
  private isStopped = false;

  private readonly api: RunsApi;
  private readonly plan: FollowPlan;

  constructor(api: RunsApi, plan: FollowPlan) {
    this.api = api;
    this.plan = plan;
    this.next = plan.from;
  }

  /** The first event not yet seen. */
  get offset(): number {
    return this.next;
  }

  start(): void {
    void this.follow();
  }

  /** Tries again after `lost()`, with the reconnects counted afresh. */
  reconnect(): void {
    this.tries = 0;
    this.start();
  }

  stop(): void {
    this.isStopped = true;
    clearTimeout(this.retry);
    this.control?.abort();
  }

  private async follow(): Promise<void> {
    const control = new AbortController();
    this.control = control;
    try {
      await this.api.follow(
        this.plan.id,
        this.next,
        (event, line) => this.take(event, line),
        control.signal,
      );
    } catch (error: unknown) {
      if (this.isStopped) return;
      if (statusOf(error) === RUN_UNKNOWN) return this.plan.listener.gone();
    }
    if (!this.isStopped && !this.plan.listener.hasEnded()) this.dropped();
  }

  private take(event: RunEvent, line: string): void {
    if (this.isStopped) return;
    this.next = event.n + 1;
    this.tries = 0;
    this.plan.listener.event(event, line);
  }

  private dropped(): void {
    this.tries++;
    if (this.tries > RECONNECTS) return this.plan.listener.lost();
    this.plan.listener.reconnecting();
    this.retry = setTimeout(() => this.start(), FIRST_RETRY_MS * 2 ** (this.tries - 1));
  }
}
