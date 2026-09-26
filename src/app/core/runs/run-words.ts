import { RunState } from './runs.types';

/** A run's state as the page holds it: the runner's, or how its stream is. */
export type RunLinkState = RunState | 'reconnecting' | 'lost';

/** How a run reads: a run that ended cleanly with an error of Claude Code's
 *  own, such as its turn limit, is `errored`, not done. */
export type RunShownState = RunLinkState | 'errored';

export const RUN_WORDS: Readonly<Record<RunShownState, string>> = {
  starting: 'Starting',
  running: 'Running',
  stopping: 'Stopping',
  done: 'Done',
  failed: 'Failed',
  cancelled: 'Cancelled',
  'time-limit': 'Time limit',
  shutdown: 'Stopped',
  reconnecting: 'Reconnecting',
  lost: 'Stream lost',
  errored: 'Error',
};

/** What a screen reader hears as a run reaches each state, once. */
export const RUN_MILESTONES: Partial<Readonly<Record<RunShownState, string>>> = {
  running: 'Task running.',
  done: 'Task done.',
  errored: 'Task ended with an error.',
  failed: 'Task failed.',
  cancelled: 'Task cancelled.',
  'time-limit': 'Task stopped at its time limit.',
  shutdown: 'Task stopped.',
};

/** The tone of a run's mark in Recent runs. */
export type MarkTone = 'ok' | 'bad' | 'live' | 'plain';

export interface RunMark {
  readonly mark: string;
  readonly tone: MarkTone;
}

const FAILED_MARK: RunMark = { mark: '✕', tone: 'bad' };
export const LIVE_MARK: RunMark = { mark: '●', tone: 'live' };
export const UNKNOWN_MARK: RunMark = { mark: '○', tone: 'plain' };

/** Each ended state's mark in Recent runs. */
export const RUN_MARKS: Partial<Readonly<Record<RunShownState, RunMark>>> = {
  done: { mark: '✓', tone: 'ok' },
  errored: FAILED_MARK,
  failed: FAILED_MARK,
  'time-limit': FAILED_MARK,
  shutdown: FAILED_MARK,
  cancelled: { mark: '⊘', tone: 'plain' },
};

export const MS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;
export const MS_PER_MINUTE = MS_PER_SECOND * SECONDS_PER_MINUTE;
/** Below a cent, a cost shows a third decimal rather than reading as $0.00. */
const CENT = 0.01;

const twoDigits = (value: number): string => String(value).padStart(2, '0');

/** "04:07" for four minutes and seven seconds. */
export function minutesSeconds(ms: number): string {
  const seconds = Math.floor(ms / MS_PER_SECOND);
  return `${twoDigits(Math.floor(seconds / SECONDS_PER_MINUTE))}:${twoDigits(seconds % SECONDS_PER_MINUTE)}`;
}

/** "42 s", "3 m 12 s" or "1 h 4 m". */
export function lasted(ms: number): string {
  const seconds = Math.round(ms / MS_PER_SECOND);
  if (seconds < SECONDS_PER_MINUTE) return `${seconds} s`;
  const minutes = Math.floor(seconds / SECONDS_PER_MINUTE);
  if (minutes < MINUTES_PER_HOUR) return `${minutes} m ${seconds % SECONDS_PER_MINUTE} s`;
  return `${Math.floor(minutes / MINUTES_PER_HOUR)} h ${minutes % MINUTES_PER_HOUR} m`;
}

export const money = (usd: number): string => `$${usd.toFixed(usd > 0 && usd < CENT ? 3 : 2)}`;

export const firstLine = (text: unknown): string =>
  String(text ?? '')
    .trim()
    .split(/\r?\n/)[0];

export const wholeMinutes = (ms: number): number => Math.round(ms / MS_PER_MINUTE);
