import { Json, fieldOf, isNumber, isObject, isText, listOf, oneOf } from '../json/json-fields';
import { RUN_STATES, RunEvent, RunResult, RunSummary, RunsReport } from './runs.types';

const numberOrNull = (value: unknown): number | null => (isNumber(value) ? value : null);
const textOrNull = (value: unknown): string | null => (isText(value) ? value : null);

function parseResult(value: unknown): RunResult | null {
  if (!isObject(value)) return null;
  return {
    error: value['error'] === true,
    subtype: textOrNull(value['subtype']),
    costUsd: numberOrNull(value['costUsd']),
    turns: numberOrNull(value['turns']),
    durationMs: numberOrNull(value['durationMs']),
  };
}

const hasIdentity = (value: Json): boolean =>
  isText(value['id']) && isText(value['folder']) && isText(value['name']);

/** One run from the runner, or null when it is not one. */
export function parseRunSummary(value: unknown): RunSummary | null {
  if (!isObject(value) || !hasIdentity(value)) return null;
  const state = fieldOf(value, 'state', oneOf(RUN_STATES));
  const startedAt = fieldOf(value, 'startedAt', isNumber);
  const limitMs = fieldOf(value, 'limitMs', isNumber);
  if (!state || startedAt === undefined || limitMs === undefined) return null;
  return {
    id: String(value['id']),
    prompt: typeof value['prompt'] === 'string' ? value['prompt'] : '',
    folder: String(value['folder']),
    name: String(value['name']),
    state,
    startedAt,
    endedAt: numberOrNull(value['endedAt']),
    limitMs,
    code: numberOrNull(value['code']),
    why: textOrNull(value['why']),
    result: parseResult(value['result']),
  };
}

/** `GET /api/runs`, or null when it is not that. */
export function parseRunsReport(body: unknown): RunsReport | null {
  if (!isObject(body) || !Array.isArray(body['recent'])) return null;
  return {
    current: parseRunSummary(body['current']),
    recent: listOf(body['recent'], parseRunSummary),
  };
}

/** One line of a run's stream, or null when it is not an event. */
export function parseRunEvent(line: string): RunEvent | null {
  let value: unknown;
  try {
    value = JSON.parse(line);
  } catch {
    return null;
  }
  if (!isObject(value)) return null;
  const n = fieldOf(value, 'n', isNumber);
  const at = fieldOf(value, 'at', isNumber);
  const kind = fieldOf(value, 'kind', isText);
  if (n === undefined || at === undefined || kind === undefined) return null;
  return { n, at, kind, data: value['data'] };
}
