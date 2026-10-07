import { fieldOf, isNumber, isObject, isText, listOf, oneOf } from '../json/json-fields';
import { LiveAgent, LiveAgentState } from './live-agents.types';

const STATES: readonly LiveAgentState[] = ['working', 'waiting', 'quiet', 'not-running'];
const isState = oneOf(STATES);

const textOrNull = (value: unknown): string | null => (isText(value) ? value : null);
const textOrEmpty = (value: unknown): string => (isText(value) ? value : '');

const isTime = (value: unknown): value is string =>
  isText(value) && Number.isFinite(Date.parse(value));

/** One agent from the API, or null when it lacks its ids, state or time, without
 *  which there is nothing to show. Any other odd field reads as blank. */
export function parseLiveAgent(value: unknown): LiveAgent | null {
  if (!isObject(value)) return null;
  const session = fieldOf(value, 'session', isText);
  const state = fieldOf(value, 'state', isState);
  const lastActiveAt = fieldOf(value, 'lastActiveAt', isTime);
  if (!session || !state || !lastActiveAt) return null;
  return {
    session,
    agentId: textOrNull(value['agentId']),
    agent: textOrNull(value['agent']),
    title: textOrEmpty(value['title']),
    project: textOrEmpty(value['project']),
    repo: textOrNull(value['repo']),
    branch: textOrNull(value['branch']),
    folder: textOrEmpty(value['folder']),
    state,
    quietMinutes: fieldOf(value, 'quietMinutes', isNumber) ?? null,
    lastActiveAt,
    lastTool: textOrNull(value['lastTool']),
    isHeadless: value['isHeadless'] === true,
  };
}

/** The agents in `GET /api/live-agents`, or null when the body is not that. */
export function parseLiveAgents(body: unknown): readonly LiveAgent[] | null {
  return isObject(body) && Array.isArray(body['agents'])
    ? listOf(body['agents'], parseLiveAgent)
    : null;
}

/** The agent in `GET /api/live-agents?session=`: it, null for none, or
 *  undefined when the body is not that answer. */
export function parseOneAgent(body: unknown): LiveAgent | null | undefined {
  if (!isObject(body) || !('agent' in body)) return undefined;
  return body['agent'] === null ? null : (parseLiveAgent(body['agent']) ?? undefined);
}
