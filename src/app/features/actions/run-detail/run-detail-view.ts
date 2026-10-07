import { ActionsRun, ActionsWorkflow } from '../../../core/actions/actions-report';
import { RunJob } from '../../../core/actions/run-jobs';
import { OUTCOME_WORDS, agoWords, eventWords, tookWords, whenWords } from '../actions-words';
import { outcomeColour } from '../run-sky/run-look';

export interface RunFact {
  readonly label: string;
  readonly value: string;
}

/** The picked run, ready to show. */
export interface RunDetail {
  readonly key: string;
  readonly runId: number;
  /** "CI · run 41". */
  readonly kind: string;
  readonly title: string;
  readonly outcome: string;
  readonly colour: string;
  readonly isFlaky: boolean;
  readonly facts: readonly RunFact[];
  readonly url: string;
  readonly workflowUrl: string | null;
  /** It failed, so it has failed jobs GitHub can run again. */
  readonly hasFailedJobs: boolean;
}

export interface StepLink {
  readonly key: string;
  readonly label: string;
  readonly url: string;
}

export interface JobView {
  readonly key: string;
  readonly name: string;
  readonly outcome: string;
  readonly colour: string;
  readonly took: string;
  readonly url: string;
  /** This job's name is known to fail and then pass on a rerun. */
  readonly isFlaky: boolean;
  readonly failedSteps: readonly StepLink[];
  /** Said under a failed job none of whose steps failed. */
  readonly note: string | null;
}

const NO_FAILED_STEP = 'No step failed: it may have failed before its steps ran. See its log.';

/** The newest failure, else the newest run: where the screen opens. */
export function firstPick(runs: readonly ActionsRun[]): string | null {
  const run = runs.find((each) => each.outcome === 'failed') ?? runs[0];
  return run ? String(run.id) : null;
}

export function runDetailOf(
  run: ActionsRun,
  workflows: readonly ActionsWorkflow[],
  now: number,
): RunDetail {
  const facts: RunFact[] = [
    { label: 'Branch', value: run.branch || 'none' },
    { label: 'Trigger', value: eventWords(run.event) },
    { label: 'Started by', value: run.actor || 'unknown' },
    { label: 'Started', value: `${whenWords(run.startedAt)} · ${agoWords(run.startedAt, now)}` },
    { label: 'Took', value: tookWords(run.durationS, run.outcome) },
  ];
  if (run.attempt > 1) facts.push({ label: 'Attempt', value: String(run.attempt) });
  return {
    key: String(run.id),
    runId: run.id,
    kind: `${run.workflow} · run ${run.number}`,
    title: run.title || `Run ${run.number}`,
    outcome: OUTCOME_WORDS[run.outcome],
    colour: outcomeColour(run.outcome),
    isFlaky: run.isFlaky,
    facts,
    url: run.url,
    workflowUrl: workflows.find((workflow) => workflow.id === run.workflowId)?.url ?? null,
    hasFailedJobs: run.outcome === 'failed',
  };
}

function failedStepsOf(job: RunJob): StepLink[] {
  return job.steps
    .filter((step) => step.outcome === 'failed')
    .map((step) => ({
      key: `${job.id}-${step.number}`,
      label: `Step ${step.number} · ${step.name}`,
      url: step.url,
    }));
}

/** Each job of the run, and under each failed one the steps that failed, each linked. */
export function jobViews(jobs: readonly RunJob[], flakyChecks: readonly string[]): JobView[] {
  const flaky = new Set(flakyChecks);
  return jobs.map((job) => {
    const failedSteps = failedStepsOf(job);
    const isFailed = job.outcome === 'failed';
    return {
      key: String(job.id),
      name: job.name,
      outcome: OUTCOME_WORDS[job.outcome],
      colour: outcomeColour(job.outcome),
      took: tookWords(job.durationS, job.outcome),
      url: job.url,
      isFlaky: flaky.has(job.name),
      failedSteps,
      note: isFailed && !failedSteps.length ? NO_FAILED_STEP : null,
    };
  });
}
