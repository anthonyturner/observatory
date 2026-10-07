import type { CiHealth, CiState, RunOutcome } from './actions-types.ts';

const COMPLETED = 'completed';
const IN_PROGRESS = 'in_progress';

/** GitHub's conclusions, by what each means here. Anything not listed reads as skipped. */
const OUTCOME_BY_CONCLUSION: Readonly<Record<string, RunOutcome>> = {
  success: 'passed',
  failure: 'failed',
  timed_out: 'failed',
  startup_failure: 'failed',
  cancelled: 'cancelled',
  stale: 'cancelled',
  // A run held for someone's approval has not run yet.
  action_required: 'queued',
};

/** One outcome from GitHub's status and conclusion, for a run, a job or a step alike. */
export function outcomeOf(status: string, conclusion: string | null): RunOutcome {
  if (status === IN_PROGRESS) return 'running';
  if (status !== COMPLETED) return 'queued';
  return OUTCOME_BY_CONCLUSION[conclusion ?? ''] ?? 'skipped';
}

/** Seconds from `from` to `to`, or null when either is missing or they run backwards. */
export function secondsBetween(from: string | null, to: string | null): number | null {
  if (!from || !to) return null;
  const seconds = Math.round((Date.parse(to) - Date.parse(from)) / 1000);
  return Number.isFinite(seconds) && seconds >= 0 ? seconds : null;
}

/** A run as the health rule reads it. */
export interface HealthRun {
  readonly workflow: string;
  readonly outcome: RunOutcome;
}

/** Outcomes that say nothing of whether the code passes. */
const SILENT: ReadonlySet<RunOutcome> = new Set(['cancelled', 'skipped']);

/**
 * The branch's CI from its runs, newest first: the newest run of each
 * workflow that said something. Any of those failing is failing; else any
 * still going is running; else any passing is passing.
 */
export function ciHealthOf(repo: string, branch: string, runs: readonly HealthRun[]): CiHealth {
  const newest = new Map<string, RunOutcome>();
  for (const run of runs) {
    if (!SILENT.has(run.outcome) && !newest.has(run.workflow))
      newest.set(run.workflow, run.outcome);
  }
  const failing = [...newest].filter(([, outcome]) => outcome === 'failed').map(([name]) => name);
  return { repo, branch, state: stateOf(new Set(newest.values())), failing };
}

function stateOf(outcomes: ReadonlySet<RunOutcome>): CiState {
  if (outcomes.has('failed')) return 'failing';
  if (outcomes.has('running') || outcomes.has('queued')) return 'running';
  return outcomes.has('passed') ? 'passing' : 'none';
}
