import { isObject, isString, listOf } from '../usage/usage-parse';

/** One subagent run, as `GET /api/agent-usage` reports it. */
export interface AgentRun {
  readonly id: string;
  /** Without its plugin namespace (`agent-playbook:dev` is `dev`), or `unknown`. */
  readonly agent: string;
  readonly description: string;
  readonly project: string;
  readonly repo: string | null;
  readonly branch: string | null;
  readonly issue: number | null;
  /** The pull request its task names ("QA review PR 648"), or null. */
  readonly pull: number | null;
  readonly startedAt: string;
  readonly endedAt: string;
  readonly durationMs: number;
  readonly model: string | null;
  readonly toolUses: number;
  /** Input, output and cache writes: what the usage view counts as work. */
  readonly workTokens: number;
  /** The fullest single request of the run. */
  readonly peakContext: number;
}

/** A month of subagent runs, newest first. */
export interface AgentUsageDocument {
  readonly generatedAt: string;
  readonly days: number;
  readonly from: string;
  readonly runs: readonly AgentRun[];
}

const isCount = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0;
const isWhole = (value: unknown): value is number => isCount(value) && Number.isInteger(value);
const textOrNull = (value: unknown): string | null => (isString(value) && value ? value : null);

function parseRun(value: unknown): AgentRun | null {
  if (!isObject(value)) return null;
  const { id, agent, startedAt, endedAt, workTokens, peakContext } = value;
  if (!isString(id) || !isString(agent) || !isString(startedAt) || !isString(endedAt)) return null;
  if (!isCount(workTokens) || !isCount(peakContext)) return null;
  const { issue, pull } = value;
  return {
    id,
    agent,
    description: isString(value['description']) ? value['description'] : '',
    project: isString(value['project']) ? value['project'] : 'unknown',
    repo: textOrNull(value['repo']),
    branch: textOrNull(value['branch']),
    issue: isWhole(issue) ? issue : null,
    pull: isWhole(pull) ? pull : null,
    startedAt,
    endedAt,
    durationMs: isCount(value['durationMs']) ? value['durationMs'] : 0,
    model: textOrNull(value['model']),
    toolUses: isCount(value['toolUses']) ? value['toolUses'] : 0,
    workTokens,
    peakContext,
  };
}

/** The report, or null when there is none (a hosted visitor, a malformed body).
 *  A malformed run is dropped rather than sinking the rest. */
export function parseAgentUsage(body: unknown): AgentUsageDocument | null {
  if (!isObject(body) || !Array.isArray(body['runs'])) return null;
  const { generatedAt, days, from } = body;
  return {
    generatedAt: isString(generatedAt) ? generatedAt : '',
    days: isCount(days) ? days : 30,
    from: isString(from) ? from : '',
    runs: listOf(body['runs'], parseRun),
  };
}
