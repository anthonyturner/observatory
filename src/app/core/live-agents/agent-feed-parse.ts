import { isObject } from '../json/json-fields';
import { AgentFeedPage } from './agent-feed.types';

const isCursor = (value: unknown): value is number | null =>
  value === null || (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0);

/** The feed's answer, or null when it is not one. */
export function parseAgentFeed(body: unknown): AgentFeedPage | null {
  if (!isObject(body)) return null;
  const { events, next, isRestart } = body;
  if (!Array.isArray(events) || !isCursor(next) || typeof isRestart !== 'boolean') return null;
  return { events, next, isRestart };
}
