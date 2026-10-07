import { isNumber, isObject, isText, listOf, oneOf } from '../json/json-fields';

/** How a run, a job or a step stands. */
export type RunOutcome = 'passed' | 'failed' | 'running' | 'queued' | 'cancelled' | 'skipped';
export const RUN_OUTCOMES: readonly RunOutcome[] = [
  'failed',
  'running',
  'queued',
  'passed',
  'cancelled',
  'skipped',
];

/** The default branch's CI at a glance. */
export type CiState = 'failing' | 'running' | 'passing' | 'none';
const CI_STATES: readonly CiState[] = ['failing', 'running', 'passing', 'none'];

export interface CiHealth {
  readonly repo: string;
  readonly branch: string;
  readonly state: CiState;
  /** The workflows whose newest run on the branch failed. */
  readonly failing: readonly string[];
}

export interface ActionsWorkflow {
  readonly id: number;
  readonly name: string;
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
  readonly actor: string;
  /** Milliseconds since the epoch. */
  readonly createdAt: number;
  readonly startedAt: number;
  /** Null while it has not ended. */
  readonly durationS: number | null;
  readonly outcome: RunOutcome;
  /** A job of it failed and then passed when run again. */
  readonly isFlaky: boolean;
  readonly url: string;
}

/** What `GET /api/actions` returns. */
export interface ActionsReport {
  readonly generatedAt: number;
  readonly repo: string;
  readonly workflows: readonly ActionsWorkflow[];
  /** Newest first. */
  readonly runs: readonly ActionsRun[];
  readonly flakyChecks: readonly string[];
  readonly health: CiHealth;
}

export const isRunOutcome = oneOf(RUN_OUTCOMES);
const isCiState = oneOf(CI_STATES);
const HTTPS_GITHUB = /^https:\/\/github\.com\//;

/** A time given as ISO text, in milliseconds, or null when it is not one. */
export const timeOf = (value: unknown): number | null => {
  const ms = isText(value) ? Date.parse(value) : NaN;
  return Number.isFinite(ms) ? ms : null;
};

/** Only a link to GitHub's own site is drawn as one. */
export const gitHubLinkOf = (value: unknown): string | null =>
  isText(value) && HTTPS_GITHUB.test(value) ? value : null;

const textOr = (value: unknown, otherwise: string): string => (isText(value) ? value : otherwise);
const textsOf = (value: unknown): string[] => listOf(value, (item) => (isText(item) ? item : null));
export const durationOf = (value: unknown): number | null =>
  isNumber(value) && value >= 0 ? value : null;

export function parseCiHealth(value: unknown): CiHealth | null {
  if (!isObject(value) || !isText(value['repo']) || !isCiState(value['state'])) return null;
  return {
    repo: value['repo'],
    branch: textOr(value['branch'], 'main'),
    state: value['state'],
    failing: textsOf(value['failing']),
  };
}

function parseWorkflow(value: unknown): ActionsWorkflow | null {
  if (!isObject(value) || !isNumber(value['id']) || !isText(value['name'])) return null;
  const url = gitHubLinkOf(value['url']);
  if (!url) return null;
  return { id: value['id'], name: value['name'], isActive: value['isActive'] !== false, url };
}

function parseRun(value: unknown): ActionsRun | null {
  if (!isObject(value)) return null;
  const { id, workflowId, number, outcome } = value;
  const createdAt = timeOf(value['createdAt']);
  const url = gitHubLinkOf(value['url']);
  if (!isNumber(id) || !isNumber(workflowId) || !isNumber(number) || !isRunOutcome(outcome)) {
    return null;
  }
  if (createdAt === null || !url) return null;
  return {
    id,
    workflowId,
    workflow: textOr(value['workflow'], 'Workflow'),
    title: textOr(value['title'], ''),
    number,
    attempt: isNumber(value['attempt']) ? value['attempt'] : 1,
    event: textOr(value['event'], ''),
    branch: textOr(value['branch'], ''),
    actor: textOr(value['actor'], ''),
    createdAt,
    startedAt: timeOf(value['startedAt']) ?? createdAt,
    durationS: durationOf(value['durationS']),
    outcome,
    isFlaky: value['isFlaky'] === true,
    url,
  };
}

/** The report, checked field by field, or null when the answer is not one. */
export function parseActionsReport(body: unknown): ActionsReport | null {
  if (!isObject(body) || !isText(body['repo'])) return null;
  const generatedAt = timeOf(body['generatedAt']);
  const health = parseCiHealth(body['health']);
  if (generatedAt === null || !health) return null;
  return {
    generatedAt,
    repo: body['repo'],
    workflows: listOf(body['workflows'], parseWorkflow),
    runs: listOf(body['runs'], parseRun),
    flakyChecks: textsOf(body['flakyChecks']),
    health,
  };
}
