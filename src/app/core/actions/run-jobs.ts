import { isNumber, isObject, isText, listOf } from '../json/json-fields';
import { RunOutcome, durationOf, gitHubLinkOf, isRunOutcome } from './actions-report';

export interface RunStep {
  readonly number: number;
  readonly name: string;
  readonly outcome: RunOutcome;
  /** The step's place in its job's log on GitHub. */
  readonly url: string;
}

export interface RunJob {
  readonly id: number;
  readonly name: string;
  readonly outcome: RunOutcome;
  readonly durationS: number | null;
  readonly url: string;
  readonly steps: readonly RunStep[];
}

/** What `GET /api/actions/run` returns: one run's jobs. */
export interface RunJobs {
  readonly runId: number;
  readonly jobs: readonly RunJob[];
}

function parseStep(value: unknown): RunStep | null {
  if (!isObject(value) || !isNumber(value['number']) || !isText(value['name'])) return null;
  const url = gitHubLinkOf(value['url']);
  if (!isRunOutcome(value['outcome']) || !url) return null;
  return { number: value['number'], name: value['name'], outcome: value['outcome'], url };
}

function parseJob(value: unknown): RunJob | null {
  if (!isObject(value) || !isNumber(value['id']) || !isText(value['name'])) return null;
  const url = gitHubLinkOf(value['url']);
  if (!isRunOutcome(value['outcome']) || !url) return null;
  return {
    id: value['id'],
    name: value['name'],
    outcome: value['outcome'],
    durationS: durationOf(value['durationS']),
    url,
    steps: listOf(value['steps'], parseStep),
  };
}

/** The jobs, checked field by field, or null when the answer is not a run's. */
export function parseRunJobs(body: unknown): RunJobs | null {
  if (!isObject(body) || !isNumber(body['runId'])) return null;
  return { runId: body['runId'], jobs: listOf(body['jobs'], parseJob) };
}
