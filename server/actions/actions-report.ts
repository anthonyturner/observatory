import {
  type ActionsReader,
  type RunJob,
  type Workflow,
  type WorkflowRun,
  WORKFLOW_FOLDER,
} from '../github/actions-reader.ts';
import type { CheckAttempt, CheckHistoryReader } from '../github/check-history.ts';
import { flakyCheckNames } from '../queue/flaky-checks.ts';
import type {
  ActionsJob,
  ActionsReport,
  ActionsRun,
  ActionsWorkflow,
  CiHealth,
  RunJobsReport,
} from './actions-types.ts';
import { ciHealthOf, outcomeOf, secondsBetween } from './run-outcome.ts';

/** Everything the Actions report reads from GitHub. */
export type ActionsSources = ActionsReader & CheckHistoryReader;

const ACTIVE = 'active';

/** A workflow's page of runs on GitHub; one GitHub made itself, such as Pages, has none of its own. */
export function workflowUrl(repo: string, path: string): string {
  return path.startsWith(WORKFLOW_FOLDER)
    ? `https://github.com/${repo}/actions/workflows/${path.slice(WORKFLOW_FOLDER.length)}`
    : `https://github.com/${repo}/actions`;
}

/** The commits at which some job failed and then passed when run again: flaky, not broken. */
export function flakyCommits(attempts: readonly CheckAttempt[]): ReadonlySet<string> {
  const bySha = Map.groupBy(attempts, (attempt) => attempt.sha);
  return new Set([...bySha].filter(([, each]) => flakyCheckNames(each).size).map(([sha]) => sha));
}

const workflowOf = (repo: string, workflow: Workflow): ActionsWorkflow => ({
  id: workflow.id,
  name: workflow.name,
  path: workflow.path,
  isActive: workflow.state === ACTIVE,
  url: workflowUrl(repo, workflow.path),
});

/** What a run knows besides itself: its workflow's name, and the commits found flaky. */
export interface RunContext {
  /** By workflow id. A run's own name can be its title instead, as Dependabot's are. */
  readonly workflowNames: ReadonlyMap<number, string>;
  readonly flaky: ReadonlySet<string>;
}

export function actionsRunOf(run: WorkflowRun, context: RunContext): ActionsRun {
  const outcome = outcomeOf(run.status, run.conclusion);
  const hasEnded = run.status === 'completed';
  return {
    id: run.id,
    workflowId: run.workflowId,
    workflow: context.workflowNames.get(run.workflowId) ?? run.workflowName,
    title: run.title,
    number: run.number,
    attempt: run.attempt,
    event: run.event,
    branch: run.branch,
    sha: run.sha,
    actor: run.actor,
    createdAt: run.createdAt,
    startedAt: run.startedAt,
    durationS: hasEnded ? secondsBetween(run.startedAt, run.updatedAt) : null,
    outcome,
    isFlaky: run.attempt > 1 && context.flaky.has(run.sha),
    url: run.url,
  };
}

/** The default branch's CI: two requests, light enough for every project card on Home. */
export async function ciHealthReport(github: ActionsReader, repo: string): Promise<CiHealth> {
  const branch = await github.defaultBranch(repo);
  const runs = await github.workflowRuns(repo, branch);
  return ciHealthOf(
    repo,
    branch,
    runs.map((run) => ({
      workflowId: run.workflowId,
      workflow: run.workflowName,
      outcome: outcomeOf(run.status, run.conclusion),
    })),
  );
}

/** Flaky tags are a hint on top of the runs, so a failure to read them leaves the runs untagged. */
async function attemptsOf(github: CheckHistoryReader, repo: string): Promise<CheckAttempt[]> {
  try {
    return await github.checkHistory(repo);
  } catch (error: unknown) {
    console.error(`Could not read ${repo}'s reruns for flaky checks:`, error);
    return [];
  }
}

/** The Actions screen's report, rebuilt from GitHub on every read. */
export async function actionsReport(
  github: ActionsSources,
  repo: string,
  now = Date.now(),
): Promise<ActionsReport> {
  const [workflows, runs, attempts, health] = await Promise.all([
    github.workflows(repo),
    github.workflowRuns(repo),
    attemptsOf(github, repo),
    ciHealthReport(github, repo),
  ]);
  const context: RunContext = {
    workflowNames: new Map(workflows.map((workflow) => [workflow.id, workflow.name])),
    flaky: flakyCommits(attempts),
  };
  return {
    generatedAt: new Date(now).toISOString(),
    repo,
    workflows: workflows.map((workflow) => workflowOf(repo, workflow)),
    runs: runs.map((run) => actionsRunOf(run, context)),
    flakyChecks: [...flakyCheckNames(attempts)].sort(),
    health,
  };
}

/** GitHub opens a job's log at a step with this anchor. */
const stepUrl = (jobUrl: string, step: number): string => `${jobUrl}#step:${step}:1`;

export const actionsJobOf = (job: RunJob): ActionsJob => ({
  id: job.id,
  name: job.name,
  outcome: outcomeOf(job.status, job.conclusion),
  durationS: secondsBetween(job.startedAt, job.completedAt),
  url: job.url,
  steps: job.steps.map((step) => ({
    number: step.number,
    name: step.name,
    outcome: outcomeOf(step.status, step.conclusion),
    url: stepUrl(job.url, step.number),
  })),
});

export async function runJobsReport(
  github: ActionsReader,
  repo: string,
  runId: number,
): Promise<RunJobsReport> {
  return { repo, runId, jobs: (await github.runJobs(repo, runId)).map(actionsJobOf) };
}
