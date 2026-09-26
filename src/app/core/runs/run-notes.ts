import { RunNote } from './run-record';
import { MS_PER_SECOND, minutesSeconds, wholeMinutes } from './run-words';

/** What a run's ending note is made from. */
export interface RunEnding {
  readonly state: string;
  readonly folder: string;
  readonly startedAt: number;
  readonly endedAt: number | null;
  readonly limitMs: number;
  readonly why: string | null;
}

const STAYS = 'Anything Claude already changed stays changed';

/** By the runner's state; one with nothing to add, such as done, has none. */
const ENDING_WORDS: Readonly<Record<string, (run: RunEnding, at: string) => string>> = {
  failed: (run) => `Stopped with an error: ${run.why ?? 'Claude Code did not finish'}.`,
  cancelled: (run, at) => `Cancelled at ${at}. ${STAYS}; check git status in ${run.folder}.`,
  'time-limit': (run) => `Stopped at the ${wholeMinutes(run.limitMs)}-minute limit. ${STAYS}.`,
  shutdown: () => 'Stopped: the local site shut down during the run.',
};

/** How `run` ended, in words, or null when there is nothing to add. A stop
 *  the runner could not confirm says so after the usual words. */
export function endNoteOf(run: RunEnding, now: number): RunNote | null {
  const words = ENDING_WORDS[run.state];
  if (!words) return null;
  const at = minutesSeconds(Math.max(0, (run.endedAt ?? now) - run.startedAt));
  const unsure = run.state !== 'failed' && run.why ? ` ${run.why}` : '';
  return {
    text: words(run, at) + unsure,
    isBad: run.state !== 'cancelled' || !!unsure,
    action: null,
  };
}

/** What a reload that picked a run up again says, by whether this tab had
 *  kept what it read. */
export const PICKED_UP_KEPT = 'Reconnected. Picking up where this tab left off.';
export const PICKED_UP_FRESH = 'Reconnected. Showing the run from the start.';

export const LOST_STREAM = 'Lost the run’s stream. It may still be running.';
export const PAST_GONE =
  'The local site no longer has this run. It keeps the last five, and only until it restarts.';
/** Claude Code runs the owner's hooks before it says anything, which can take
 *  a minute or more, so a quiet start says why it is quiet. */
export const slowStartNote = (ms: number): string =>
  `Waiting for Claude Code’s first output (${Math.round(ms / MS_PER_SECOND)} s). Your Claude Code hooks run first, so this can take a while.`;
