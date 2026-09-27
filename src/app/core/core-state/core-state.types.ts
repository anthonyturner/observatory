import { CoreStateId } from '../instrument/core-states';

/** How much effort a reply took: an app action, an answer, or a task. */
export type CoreTier = 1 | 2 | 3;

/** What a source of the core's state may do to it. The last one to write
 *  wins, as on pr-starmap's Home: the core shows what happened most recently. */
export interface CoreStateWriter {
  /** Shows `state` until something else is shown. */
  show(state: CoreStateId): void;
  /** Shows `state` for `holdMs`, then idle, unless something else was shown first. */
  flash(state: CoreStateId, holdMs: number): void;
  /** Back to idle, if the core still shows `state`. */
  end(state: CoreStateId): void;
  /** Speaking a reply of `tier`, whose arc stays lit while it is heard. */
  speak(tier: CoreTier): void;
}

/** What a running task may do to the core. While one runs, the core rests on
 *  running instead of idle, and a reply read aloud does not take it over. */
export interface CoreRunWriter {
  beginRun(): void;
  /** Shows how the task ended for `holdMs`, or at once with no hold, unless
   *  the core is busy with something else. */
  endRun(outcome: CoreStateId, holdMs: number): void;
}

/** Something that drives the core: the Ask feed, the mic, a reply read aloud.
 *  It starts following its source when connected, until its injector ends. */
export interface CoreStateSource {
  connect(): void;
}

/** The index of `tier`'s arc on the core's tier ring, 0 to 2. */
export const arcOf = (tier: CoreTier): number => tier - 1;
