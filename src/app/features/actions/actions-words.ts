import { CiHealth, RunOutcome } from '../../core/actions/actions-report';
import { ageOf } from '../../core/usage/usage-format';

/* How the Actions screen names outcomes, durations, triggers and times. */

export const OUTCOME_WORDS: Readonly<Record<RunOutcome, string>> = {
  passed: 'Passed',
  failed: 'Failed',
  running: 'Running',
  queued: 'Queued',
  cancelled: 'Cancelled',
  skipped: 'Skipped',
};

/** "main is failing (CI, Deploy)", "main is passing", "main has no runs yet". */
export function ciHealthWords(health: CiHealth): string {
  if (health.state === 'none') return `${health.branch} has no runs yet`;
  const failing = health.failing.length ? ` (${health.failing.join(', ')})` : '';
  return `${health.branch} is ${health.state}${failing}`;
}

const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 3600;

/** "48s", "3m 12s", "1h 4m". */
export function durationWords(seconds: number): string {
  if (seconds < SECONDS_PER_MINUTE) return `${seconds}s`;
  if (seconds < SECONDS_PER_HOUR) {
    const rest = seconds % SECONDS_PER_MINUTE;
    return `${Math.floor(seconds / SECONDS_PER_MINUTE)}m${rest ? ` ${rest}s` : ''}`;
  }
  const minutes = Math.round((seconds % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE);
  return `${Math.floor(seconds / SECONDS_PER_HOUR)}h${minutes ? ` ${minutes}m` : ''}`;
}

/** "pull request" for `pull_request`: GitHub's event names, as words. */
export const eventWords = (event: string): string => event.replaceAll('_', ' ');

/** "3h ago", or "just now", counted from when the report was made. */
export function agoWords(at: number, now: number): string {
  const age = ageOf(new Date(at).toISOString(), now);
  return age === 'now' ? 'just now' : `${age} ago`;
}

/** "7 Oct, 14:05", in the browser's locale. */
export const whenWords = (at: number): string =>
  new Date(at).toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

/** How long it took, or that it is still going. */
export const tookWords = (durationS: number | null, outcome: RunOutcome): string =>
  durationS === null ? OUTCOME_WORDS[outcome].toLowerCase() : durationWords(durationS);
