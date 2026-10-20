import { Injectable, computed, inject, signal } from '@angular/core';
import { LogSkyLayout, LogStar, layoutLogs } from '../../core/logs/log-layout';
import { logLegend } from '../../core/logs/log-legend';
import { LogFilter, LogKey } from '../../core/logs/log-levels';
import { withOlder } from '../../core/logs/log-older';
import { logStamp } from '../../core/logs/log-stamp';
import { sameFaultStar, traceOnPick } from '../../core/logs/log-trace';
import { LogsFeed } from '../../core/logs/logs-feed';
import { ageWords, fogLevel } from '../../core/projects/data-age';
import { Clock } from '../../core/time/clock';
import { LegendChip } from './starmap-view';

/** pr-starmap's log inks, which the canvas paints each star with. */
const LOG_PALETTE: Readonly<Record<LogKey, string>> = {
  error: '#ff6f5e',
  warn: '#ffc24d',
  quiet: '#5fe3a1',
};

/** A message in place of the Log Sky, when there is nothing to chart. */
export interface LogSkyMessage {
  readonly headline: string;
  readonly detail?: string;
}

/**
 * The Log Sky's state on the star map page: its snapshot and layout, legend
 * and stamp, the star whose card is open and the fault whose threads are drawn.
 * Closing the card keeps the trace; picking again, empty sky or a new filter
 * clears it, as on pr-starmap.
 */
@Injectable()
export class LogSkyView {
  private readonly feed = inject(LogsFeed);
  private readonly now = inject(Clock).now;

  readonly filter = signal<LogFilter>(null);
  readonly selected = signal<LogStar | null>(null);
  readonly traced = signal<LogStar | null>(null);

  private readonly received = computed(() => {
    const state = this.feed.state();
    return state.status === 'ready' ? state.snapshot : null;
  });
  private readonly showingOlder = signal(false);

  /** What the sky shows: the snapshot, with its older faults counted in only while they are shown. */
  readonly snapshot = computed(() => {
    const received = this.received();
    return received && this.showingOlder() ? withOlder(received) : received;
  });
  /** Faults the sky leaves out as older, whether or not they are shown. */
  readonly olderCount = computed(() => this.received()?.older.count ?? 0);
  readonly isShowingOlder = this.showingOlder.asReadonly();
  readonly layout = computed<LogSkyLayout>(() => layoutLogs(this.snapshot(), LOG_PALETTE));
  readonly chips = computed((): LegendChip[] =>
    logLegend(this.snapshot(), this.layout()).map((entry) => ({
      id: entry.key,
      colour: entry.colour,
      count: entry.count,
      text: entry.label,
      live: entry.isLive,
    })),
  );
  readonly stamp = computed(() => logStamp(this.snapshot(), this.layout()));
  readonly fog = computed(() => {
    const snapshot = this.snapshot();
    return snapshot ? fogLevel(snapshot.generatedAt, this.now()) : 0;
  });
  readonly stale = computed(() => {
    const snapshot = this.snapshot();
    return snapshot && this.fog() > 0
      ? `fogged · ${ageWords(snapshot.generatedAt, this.now())} old`
      : null;
  });
  /** When the sky was last cleared, or null while every line counts. */
  readonly clearedAt = computed(() => this.snapshot()?.clearedAt ?? null);
  /** A clear, a reset or a fresh read is on its way. */
  readonly isWaiting = this.feed.isWaiting;
  /** Why the last clear or reset did not take, or null. */
  readonly failure = this.feed.failure;
  /** Whether the meteor record has days to show. */
  readonly hasDays = computed(() => (this.snapshot()?.timeline.length ?? 0) > 0);
  readonly message = computed((): LogSkyMessage | null => {
    const state = this.feed.state();
    if (state.status === 'unconfigured') {
      return {
        headline: 'No logs charted yet.',
        detail: 'Record a log folder with server/logs/set-dir.ts, then press Refresh.',
      };
    }
    if (state.status === 'unreachable') {
      return { headline: 'The logs are out of reach.', detail: 'Is the API running?' };
    }
    return null;
  });

  watch(repo: string): void {
    this.showingOlder.set(false);
    this.feed.watch(repo);
  }

  /** Brings the older faults into the sky, or leaves them out again. */
  toggleOlder(): void {
    this.showingOlder.update((showing) => !showing);
  }

  /** Reads the folder again now, not the copy the API kept. */
  refresh(): void {
    this.feed.refresh();
  }

  /** Every error and warning logged up to now is ignored from here on. */
  clearToNow(): void {
    this.feed.clearToNow();
  }

  /** Undoes the clear: every line counts again. */
  restore(): void {
    this.feed.restore();
  }

  /** A click on the sky: a star opens its card and traces its fault; empty sky clears both. */
  pick(star: LogStar | null): void {
    this.selected.set(star);
    this.traced.set(traceOnPick(star));
  }

  /** Closing the card leaves the threads up, to study. */
  closeCard(): void {
    this.selected.set(null);
  }

  toggleFilter(key: LogKey): void {
    this.filter.update((current) => (current === key ? null : key));
    this.clear();
  }

  /** Leaving the Log Sky, or changing what it shows, starts it afresh. */
  clear(): void {
    this.selected.set(null);
    this.traced.set(null);
  }

  /** After a refresh, the same fault in the new layout, if it is still there. */
  follow(): void {
    const stars = this.layout().stars;
    const refind = (star: LogStar | null): LogStar | null =>
      star?.fault
        ? sameFaultStar(star.fault, stars)
        : star?.win
          ? (stars.find((s) => s.win?.id === star.win?.id) ?? null)
          : null;
    this.selected.set(refind(this.selected()));
    this.traced.set(refind(this.traced()));
  }
}
