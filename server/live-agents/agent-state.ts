import type { LiveAgentState } from './live-agent-types.ts';

/** Written to this recently, an agent is taken to be working. A long build or
 *  a pending permission prompt writes nothing, so a quiet one may still be busy. */
export const WORKING_MS = 2 * 60_000;
/** Silent longer than this, an agent is taken to have stopped and leaves the list. */
export const LISTED_MS = 30 * 60_000;

const MINUTE_MS = 60_000;

/** What classifying an agent needs to know about its transcript. */
export interface Activity {
  readonly lastWriteAt: number;
  readonly isTurnEnded: boolean;
  /** Its spawner has its answer: true for a finished subagent, never for a session. */
  readonly isFinished: boolean;
}

export interface Classified {
  readonly state: LiveAgentState;
  readonly quietMinutes: number | null;
}

/** Where an agent stands at `now`: waiting on its user, working, quiet, or no longer running. */
export function classify(activity: Activity, now: number): Classified {
  const silentMs = Math.max(0, now - activity.lastWriteAt);
  const isGone = activity.isFinished || silentMs > LISTED_MS;
  if (isGone) return { state: 'not-running', quietMinutes: null };
  if (activity.isTurnEnded) return { state: 'waiting', quietMinutes: null };
  if (silentMs < WORKING_MS) return { state: 'working', quietMinutes: null };
  return { state: 'quiet', quietMinutes: Math.floor(silentMs / MINUTE_MS) };
}
