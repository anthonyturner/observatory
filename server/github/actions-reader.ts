import { type Json, type JsonGet, isJson, isText, jsonListIn } from './rest-json.ts';

/** One GitHub Actions workflow run, as GitHub lists it. */
export interface WorkflowRun {
  readonly id: number;
  readonly workflowId: number;
  readonly workflowName: string;
  /** GitHub's title for the run: its commit's message or its pull request's title. */
  readonly title: string;
  readonly number: number;
  /** 1 for the first try; each rerun adds one. */
  readonly attempt: number;
  /** What started it: `push`, `pull_request`, `schedule`... */
  readonly event: string;
  readonly branch: string;
  readonly sha: string;
  /** `queued`, `in_progress`, `completed`... */
  readonly status: string;
  /** How it ended, once `completed`: `success`, `failure`, `cancelled`... */
  readonly conclusion: string | null;
  /** The login that started it; empty when GitHub no longer knows the account. */
  readonly actor: string;
  readonly createdAt: string;
  /** When the latest attempt started. */
  readonly startedAt: string;
  readonly updatedAt: string;
  readonly url: string;
}

/** One workflow file in a repository. */
export interface Workflow {
  readonly id: number;
  readonly name: string;
  readonly path: string;
  /** `active`, or one of the ways it was switched off. */
  readonly state: string;
}

export interface RunStep {
  readonly number: number;
  readonly name: string;
  readonly status: string;
  readonly conclusion: string | null;
}

/** One job of a run's latest attempt, with its steps. */
export interface RunJob {
  readonly id: number;
  readonly name: string;
  readonly status: string;
  readonly conclusion: string | null;
  readonly url: string;
  readonly startedAt: string | null;
  readonly completedAt: string | null;
  readonly steps: readonly RunStep[];
}

/** What the Actions screen reads of a repository's workflows and runs, and nothing else. */
export interface ActionsReader {
  /** The newest runs, newest first, up to RUN_LIMIT; only one branch's when `branch` is given. */
  workflowRuns(repo: string, branch?: string): Promise<WorkflowRun[]>;
  workflows(repo: string): Promise<Workflow[]>;
  /** The jobs of a run's latest attempt. */
  runJobs(repo: string, runId: number): Promise<RunJob[]>;
  defaultBranch(repo: string): Promise<string>;
}

/** One request's worth: GitHub lists at most a hundred a page. */
export const RUN_LIMIT = 100;
const JOB_LIMIT = 100;
const WORKFLOW_LIMIT = 100;

const isId = (value: unknown): value is number => Number.isInteger(value) && Number(value) > 0;
const textOr = (value: unknown, otherwise: string): string => (isText(value) ? value : otherwise);
const textOrNull = (value: unknown): string | null => (isText(value) ? value : null);

export const WORKFLOW_FOLDER = '.github/workflows/';

/** A workflow file with no `name:` goes by its path, which reads better as the file's name. */
export function workflowLabelOf(name: unknown, path: unknown): string {
  if (isText(name) && !name.startsWith(WORKFLOW_FOLDER)) return name;
  const from = isText(path) ? path : textOr(name, '');
  return from.startsWith(WORKFLOW_FOLDER)
    ? from.slice(WORKFLOW_FOLDER.length)
    : textOr(from, 'Workflow');
}

function runOf(run: Json): WorkflowRun | null {
  const { id, workflow_id: workflowId, run_number: number, html_url: url } = run;
  const { head_sha: sha, status, created_at: createdAt, updated_at: updatedAt } = run;
  if (!isId(id) || !isId(workflowId) || !isId(number) || !isText(url) || !isText(sha)) return null;
  if (!isText(status) || !isText(createdAt) || !isText(updatedAt)) return null;
  const actor = isJson(run['actor']) ? run['actor']['login'] : null;
  return {
    id,
    workflowId,
    workflowName: workflowLabelOf(run['name'], run['path']),
    title: textOr(run['display_title'], ''),
    number,
    attempt: isId(run['run_attempt']) ? run['run_attempt'] : 1,
    event: textOr(run['event'], ''),
    branch: textOr(run['head_branch'], ''),
    sha,
    status,
    conclusion: textOrNull(run['conclusion']),
    actor: textOr(actor, ''),
    createdAt,
    startedAt: textOr(run['run_started_at'], createdAt),
    updatedAt,
    url,
  };
}

/** The runs in a `GET /actions/runs` answer, as GitHub orders them: newest first. */
export const workflowRunsOf = (body: unknown): WorkflowRun[] =>
  jsonListIn(body, 'workflow_runs')
    .map(runOf)
    .filter((run) => run !== null);

/** The workflows in a `GET /actions/workflows` answer. */
export function workflowsOf(body: unknown): Workflow[] {
  return jsonListIn(body, 'workflows').flatMap(({ id, name, path, state }) =>
    isId(id) && isText(path)
      ? [{ id, name: workflowLabelOf(name, path), path, state: textOr(state, '') }]
      : [],
  );
}

function stepOf(step: Json): RunStep | null {
  const { number, name, status } = step;
  if (!isId(number) || !isText(name) || !isText(status)) return null;
  return { number, name, status, conclusion: textOrNull(step['conclusion']) };
}

function jobOf(job: Json): RunJob | null {
  const { id, name, status, html_url: url } = job;
  if (!isId(id) || !isText(name) || !isText(status) || !isText(url)) return null;
  const steps = Array.isArray(job['steps']) ? job['steps'].filter(isJson) : [];
  return {
    id,
    name,
    status,
    conclusion: textOrNull(job['conclusion']),
    url,
    startedAt: textOrNull(job['started_at']),
    completedAt: textOrNull(job['completed_at']),
    steps: steps.map(stepOf).filter((step) => step !== null),
  };
}

/** The jobs in a `GET /actions/runs/{id}/jobs` answer. */
export const runJobsOf = (body: unknown): RunJob[] =>
  jsonListIn(body, 'jobs')
    .map(jobOf)
    .filter((job) => job !== null);

/** The default branch in a `GET /repos/{repo}` answer, or `main` when it says none. */
export const defaultBranchOf = (body: unknown): string =>
  textOr(isJson(body) ? body['default_branch'] : null, 'main');

export async function readWorkflowRuns(
  get: JsonGet,
  repo: string,
  branch?: string,
): Promise<WorkflowRun[]> {
  const onBranch = branch ? `&branch=${encodeURIComponent(branch)}` : '';
  return workflowRunsOf(
    await get(
      `repos/${repo}/actions/runs?per_page=${RUN_LIMIT}&exclude_pull_requests=true${onBranch}`,
    ),
  );
}

export async function readWorkflows(get: JsonGet, repo: string): Promise<Workflow[]> {
  return workflowsOf(await get(`repos/${repo}/actions/workflows?per_page=${WORKFLOW_LIMIT}`));
}

export async function readRunJobs(get: JsonGet, repo: string, runId: number): Promise<RunJob[]> {
  return runJobsOf(await get(`repos/${repo}/actions/runs/${runId}/jobs?per_page=${JOB_LIMIT}`));
}

export async function readDefaultBranch(get: JsonGet, repo: string): Promise<string> {
  return defaultBranchOf(await get(`repos/${repo}`));
}
