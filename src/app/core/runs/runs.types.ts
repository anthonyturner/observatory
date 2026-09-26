/** A run's state as the local runner reports it. */
export type RunState =
  'starting' | 'running' | 'stopping' | 'done' | 'failed' | 'cancelled' | 'time-limit' | 'shutdown';

export const RUN_STATES: readonly RunState[] = [
  'starting',
  'running',
  'stopping',
  'done',
  'failed',
  'cancelled',
  'time-limit',
  'shutdown',
];

/** The states a run never leaves. */
const ENDED_STATES: ReadonlySet<string> = new Set<RunState>([
  'done',
  'failed',
  'cancelled',
  'time-limit',
  'shutdown',
]);

/** Whether a run in `state`, the runner's or the page's own, has ended. */
export const isEndedState = (state: string): boolean => ENDED_STATES.has(state);

/** What the runner kept of Claude Code's closing `result` event. */
export interface RunResult {
  readonly error: boolean;
  readonly subtype: string | null;
  readonly costUsd: number | null;
  readonly turns: number | null;
  readonly durationMs: number | null;
}

/** One run, as the list and the start and cancel answers give it. */
export interface RunSummary {
  readonly id: string;
  readonly prompt: string;
  readonly folder: string;
  readonly name: string;
  readonly state: RunState;
  readonly startedAt: number;
  readonly endedAt: number | null;
  readonly limitMs: number;
  /** Claude Code's exit code; null until it exits. */
  readonly code: number | null;
  /** Why it failed, or what could not be confirmed. */
  readonly why: string | null;
  readonly result: RunResult | null;
}

/** `GET /api/runs`: the run going now, and the last few, newest first. */
export interface RunsReport {
  readonly current: RunSummary | null;
  readonly recent: readonly RunSummary[];
}

/** One line of a run's NDJSON stream. `kind` is kept as sent, so a kind this
 *  page does not know still shows, rather than being dropped. */
export interface RunEvent {
  readonly n: number;
  readonly at: number;
  readonly kind: string;
  readonly data: unknown;
}

/** What starting a run repeats of its proposal, word for word. */
export interface StartRequest {
  readonly token: string;
  readonly prompt: string;
  readonly folder: string;
}
