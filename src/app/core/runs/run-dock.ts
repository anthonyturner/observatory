import {
  Injectable,
  computed,
  effect,
  inject,
  linkedSignal,
  signal,
  untracked,
} from '@angular/core';
import { PastRuns } from './past-runs';
import { recentRowsOf } from './run-dock-view';
import { RunRecord } from './run-record';
import { RunsStore } from './runs-store';
import { isEndedState } from './runs.types';

/**
 * The task panel beside the page: which run it shows (the followed one, or an
 * earlier one picked from Recent runs), and whether it is open. Hide folds it
 * into the pill in the top bar; a finished run stays until Close.
 */
@Injectable({ providedIn: 'root' })
export class RunDock {
  private readonly store = inject(RunsStore);
  private readonly past = inject(PastRuns);
  private readonly opened = signal(false);
  /** An earlier run on show; a newly followed run takes its place. */
  private readonly picked = linkedSignal<RunRecord | null, RunRecord | null>({
    source: this.store.followed,
    computation: () => null,
  });
  private readonly pillRequests = signal(0);
  private hasPickedUp = false;

  readonly isOpen = this.opened.asReadonly();
  readonly view = computed(() => this.picked() ?? this.store.followed());
  readonly recentRows = computed(() =>
    recentRowsOf(this.store.list(), this.store.followed(), this.view()?.id ?? null),
  );
  /** Asks the pill for the focus once Hide has folded the dock into it. */
  readonly pillFocusRequests = this.pillRequests.asReadonly();

  constructor() {
    effect(() => {
      if (this.store.isAvailable()) untracked(() => void this.pickUpOnce());
    });
  }

  /** Opens the dock on the followed run, or else the newest earlier one. */
  show(): void {
    if (!this.view()) this.showNewestPast();
    if (!this.view()) return;
    this.opened.set(true);
    void this.store.refresh();
  }

  hide(): void {
    this.opened.set(false);
    this.pillRequests.update((count) => count + 1);
  }

  /** Hide while the run is live; Close once it has ended, letting it go. */
  dismiss(): void {
    const isLive = this.store.isLive();
    this.hide();
    if (!isLive) this.store.close();
  }

  back(): void {
    this.picked.set(null);
  }

  /** Shows run `id` from Recent runs: the followed run, a live one to follow,
   *  or a finished one, read once. */
  pick(id: string): void {
    if (id === this.store.followed()?.id) return this.back();
    const { current, recent } = this.store.list();
    const summary = [current, ...recent].find((run) => run?.id === id);
    if (!summary) return;
    if (!isEndedState(summary.state)) return this.store.open(summary);
    this.picked.set(this.past.find(id) ?? this.past.load(summary));
  }

  private showNewestPast(): void {
    const newest = this.store.list().recent[0];
    if (newest) this.picked.set(this.past.find(newest.id) ?? this.past.load(newest));
  }

  /** A reload finds the run the runner is on, and opens the dock on it. */
  private async pickUpOnce(): Promise<void> {
    if (this.hasPickedUp) return;
    this.hasPickedUp = true;
    await this.store.pickUp();
    if (this.store.followed()) this.opened.set(true);
  }
}
