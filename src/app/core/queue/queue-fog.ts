import { QueueState } from './queue-feed';

const MINUTE_MS = 60_000;
/** A stale queue fogs at once, thinly, so the failure shows... */
const FIRST_FOG = 0.35;
/** ...and thickens until it is full an hour after the last good read. */
const FULL_AFTER_MS = 60 * MINUTE_MS;

/** How fogged the star map is, 0 to 1: clear while reads succeed, then
 *  thickening with the age of the last queue that could be read. */
export function queueFog(state: QueueState, now: number): number {
  if (state.status !== 'ready' || !state.isStale) return 0;
  const age = now - Date.parse(state.report.generatedAt);
  if (Number.isNaN(age)) return 1;
  return Math.min(1, FIRST_FOG + (1 - FIRST_FOG) * Math.max(0, age / FULL_AFTER_MS));
}
