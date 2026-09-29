import { Injectable, Signal, computed, inject } from '@angular/core';
import { Clock } from '../time/clock';
import { TokenDay, workTokensOf } from '../usage/usage-document';
import { UsageFeed } from '../usage/usage-feed';
import { localDayKey } from '../usage/usage-format';

/** The trails never crawl slower than this, or race faster, however the day goes. */
export const QUIETEST_PACE = 0.5;
export const BUSIEST_PACE = 4;
/** Fewer days of work than this before today, and there is no usual day to compare with. */
const MIN_WORKING_DAYS = 3;
/** Early in the day a few tokens would read as frantic, so at least two hours count as gone. */
const MIN_DAY_SHARE = 2 / 24;
/** In twentieths, so the pace moves in steps rather than every second. */
const PACE_STEPS = 20;
const DAY_MS = 24 * 60 * 60 * 1000;

/** How busy today is against a usual working day, as a multiple of the trails'
 *  natural pace: today's Claude Code work tokens over what a usual day (the
 *  median of earlier days with any work) would have reached by now, pro rata.
 *  Null when the usage cannot say. */
export function activityPace(rows: readonly TokenDay[], nowMs: number): number | null {
  const today = localDayKey(nowMs);
  const todayRow = rows.find((row) => row.day === today);
  const usual = medianOf(
    rows
      .filter((row) => row.day !== today)
      .map(workTokensOf)
      .filter((tokens) => tokens > 0),
  );
  // A document from before today says nothing about today.
  if (!todayRow || usual === null) return null;
  const expected = usual * Math.max(dayShareAt(nowMs), MIN_DAY_SHARE);
  const pace = Math.min(Math.max(workTokensOf(todayRow) / expected, QUIETEST_PACE), BUSIEST_PACE);
  return Math.round(pace * PACE_STEPS) / PACE_STEPS;
}

/** How much of the local day has gone, 0 to 1. */
function dayShareAt(nowMs: number): number {
  const midnight = new Date(nowMs);
  midnight.setHours(0, 0, 0, 0);
  return Math.min((nowMs - midnight.getTime()) / DAY_MS, 1);
}

function medianOf(values: readonly number[]): number | null {
  if (values.length < MIN_WORKING_DAYS) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

/** Today's activity pace for Home's star trails. */
@Injectable({ providedIn: 'root' })
export class TrailActivity {
  private readonly usage = inject(UsageFeed).state;
  private readonly now = inject(Clock).now;

  /** How busy today is against a usual day, or null where the usage cannot say. */
  readonly measured: Signal<number | null> = computed(() => {
    const state = this.usage();
    if (state.status !== 'ready') return null;
    return activityPace(state.document.tokens?.rows ?? [], this.now().getTime());
  });
  /** The pace the trails turn at: the natural one wherever it is not measured. */
  readonly pace: Signal<number> = computed(() => this.measured() ?? 1);
}
