import { ActivityItem, ActivityKind } from '../activity/activity.types';

/** One notice in the stack: every item of one kind from one check. */
export interface Notice {
  readonly id: number;
  readonly kind: ActivityKind;
  readonly items: readonly ActivityItem[];
}

/** Where a notice's countdown line runs from, and for how long. It changes only
 *  when the countdown starts or resumes, never as it runs. */
export interface Countdown {
  /** How much of the line is left when this run starts, from 1 (full) to 0. */
  readonly fromScale: number;
  readonly ms: number;
  /** Counts up with each run, so the line restarts rather than carrying on. */
  readonly run: number;
}
