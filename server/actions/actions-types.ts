/** How a run, a job or a step stands, in the screen's words rather than GitHub's two fields. */
export type RunOutcome = 'passed' | 'failed' | 'running' | 'queued' | 'cancelled' | 'skipped';

/** The default branch's CI at a glance: the newest run of each workflow on it. */
export type CiState = 'failing' | 'running' | 'passing' | 'none';

/** What `GET /api/ci-health` returns, and the Actions report's summary line. */
export interface CiHealth {
  readonly repo: string;
  readonly branch: string;
  readonly state: CiState;
  /** The workflows whose newest run on the branch failed, by name. */
  readonly failing: readonly string[];
}

export interface ActionsWorkflow {
  readonly id: number;
  readonly name: string;
  readonly path: string;
  readonly isActive: boolean;
  readonly url: string;
}

export interface ActionsRun {
  readonly id: number;
  readonly workflowId: number;
  readonly workflow: string;
  readonly title: string;
  readonly number: number;
  readonly attempt: number;
  readonly event: string;
  readonly branch: string;
  readonly sha: string;
  readonly actor: string;
  readonly createdAt: string;
  readonly startedAt: string;
  /** From its latest attempt's start to its end; null while it has not ended. */
  readonly durationS: number | null;
  readonly outcome: RunOutcome;
  /** A job of it failed and then passed when run again at the same commit. */
  readonly isFlaky: boolean;
  readonly url: string;
}

/** What `GET /api/actions` returns. */
export interface ActionsReport {
  readonly generatedAt: string;
  readonly repo: string;
  readonly workflows: readonly ActionsWorkflow[];
  /** Newest first. */
  readonly runs: readonly ActionsRun[];
  /** Job names known to fail and then pass on a rerun, on any branch. */
  readonly flakyChecks: readonly string[];
  readonly health: CiHealth;
}

export interface ActionsStep {
  readonly number: number;
  readonly name: string;
  readonly outcome: RunOutcome;
  /** The step's place in its job's log on GitHub. */
  readonly url: string;
}

export interface ActionsJob {
  readonly id: number;
  readonly name: string;
  readonly outcome: RunOutcome;
  readonly durationS: number | null;
  readonly url: string;
  readonly steps: readonly ActionsStep[];
}

/** What `GET /api/actions/run` returns: a run's jobs and their steps. */
export interface RunJobsReport {
  readonly repo: string;
  readonly runId: number;
  readonly jobs: readonly ActionsJob[];
}
