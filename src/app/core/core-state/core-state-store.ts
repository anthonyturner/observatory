import { Injectable, Signal, computed, signal } from '@angular/core';
import { CoreStateId } from '../instrument/core-states';
import { CoreChip, IDLE_CHIP, WORKING_CHIP, chipOf } from './core-chips';
import { CoreRunWriter, CoreStateWriter, CoreTier } from './core-state.types';

/** States a running task may replace: the core at rest, or showing a reply
 *  that has landed. Anything else is the viewer's own and is left alone. */
const AT_REST: readonly CoreStateId[] = [
  'idle',
  'running',
  'answered-1',
  'answered-2',
  'answered-3',
];

/** What the core is doing. Its sources write to it; the core, its chips and
 *  the status line read it. */
@Injectable({ providedIn: 'root' })
export class CoreStateStore implements CoreStateWriter, CoreRunWriter {
  /** Every write notifies, so a state entered again starts over, as a
   *  second answer's arc flares again. */
  private readonly current = signal<CoreStateId>('idle', { equal: () => false });
  private readonly tierSpoken = signal<CoreTier>(1);
  private readonly isRunLive = signal(false);
  private holdTimer: ReturnType<typeof setTimeout> | undefined;

  readonly state: Signal<CoreStateId> = this.current.asReadonly();
  /** The tier of the reply being read aloud, or last read. */
  readonly spokenTier: Signal<CoreTier> = this.tierSpoken.asReadonly();
  /** A reply landing mid-run is not Home at rest: the task is still working. */
  readonly chip: Signal<CoreChip> = computed(() => {
    const chip = chipOf(this.current());
    return this.isRunLive() && chip === IDLE_CHIP ? WORKING_CHIP : chip;
  });

  show(state: CoreStateId): void {
    this.enter(state);
  }

  flash(state: CoreStateId, holdMs: number): void {
    this.enter(state);
    this.holdTimer = setTimeout(() => this.enter('idle'), holdMs);
  }

  end(state: CoreStateId): void {
    if (this.current() === state) this.enter('idle');
  }

  /** A running task keeps the core on running; the reply is still heard. */
  speak(tier: CoreTier): void {
    this.tierSpoken.set(tier);
    if (!this.isRunLive()) this.enter('speaking');
  }

  beginRun(): void {
    this.isRunLive.set(true);
    if (this.isAtRest()) this.enter('running');
  }

  endRun(outcome: CoreStateId, holdMs: number): void {
    this.isRunLive.set(false);
    if (!this.isAtRest()) return;
    if (holdMs > 0) this.flash(outcome, holdMs);
    else this.show(outcome);
  }

  private isAtRest(): boolean {
    return AT_REST.includes(this.current());
  }

  /** While a task runs, idle is running: a reply or a recording ends, the task does not. */
  private enter(state: CoreStateId): void {
    clearTimeout(this.holdTimer);
    this.current.set(state === 'idle' && this.isRunLive() ? 'running' : state);
  }
}
