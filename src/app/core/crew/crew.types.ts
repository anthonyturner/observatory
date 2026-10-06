import { RunShownState } from '../runs/run-words';

/** What a crew does: bring a conflicted branch up to date, fix failing checks, or update a
 *  branch whose stacked base has merged. */
export type CrewTask = 'update-branch' | 'fix-checks' | 'update-stack';

/** Where a crew is: still at work, or back with its run done or failed. */
export type CrewPhase = 'working' | 'succeeded' | 'failed';

/** The pull request a crew was sent to. */
export interface CrewTarget {
  readonly repo: string;
  readonly number: number;
}

/** One crew: the run it is, and how that run stands. */
export interface Crew extends CrewTarget {
  readonly runId: string;
  readonly phase: CrewPhase;
  readonly state: RunShownState;
  readonly startedAt: number;
  readonly endedAt: number | null;
}

/** A crew as the sky draws it beside its star. */
export interface CrewMark {
  readonly pr: number;
  readonly phase: CrewPhase;
  readonly endedAt: number | null;
}
