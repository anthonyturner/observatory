import { ActionsRun, RUN_OUTCOMES, RunOutcome } from './actions-report';

/** What the screen narrows the runs to; null in a field lets every run through. */
export interface RunFilter {
  readonly workflow: string | null;
  readonly branch: string | null;
  readonly outcome: RunOutcome | null;
}

export const NO_FILTER: RunFilter = { workflow: null, branch: null, outcome: null };

/** The values each filter offers: only ones some run has. */
export interface FilterChoices {
  /** By name, A to Z. */
  readonly workflows: readonly string[];
  /** The most recently run first. */
  readonly branches: readonly string[];
  /** Failed first, in the order the screen ranks them. */
  readonly outcomes: readonly RunOutcome[];
}

export function filterChoices(runs: readonly ActionsRun[]): FilterChoices {
  const outcomes = new Set(runs.map((run) => run.outcome));
  return {
    workflows: [...new Set(runs.map((run) => run.workflow))].sort((a, b) => a.localeCompare(b)),
    branches: [...new Set(runs.map((run) => run.branch).filter((branch) => branch !== ''))],
    outcomes: RUN_OUTCOMES.filter((outcome) => outcomes.has(outcome)),
  };
}

export const passesFilter = (run: ActionsRun, filter: RunFilter): boolean =>
  (filter.workflow === null || run.workflow === filter.workflow) &&
  (filter.branch === null || run.branch === filter.branch) &&
  (filter.outcome === null || run.outcome === filter.outcome);

/** The runs that pass, in the order given. */
export const filterRuns = (runs: readonly ActionsRun[], filter: RunFilter): ActionsRun[] =>
  runs.filter((run) => passesFilter(run, filter));

export const isFiltered = (filter: RunFilter): boolean =>
  filter.workflow !== null || filter.branch !== null || filter.outcome !== null;
