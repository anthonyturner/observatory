import { toClockFace } from '../time/clock-format';
import { slowStartNote } from './run-notes';
import { RunNote, RunRecord } from './run-record';
import {
  LIVE_MARK,
  MS_PER_MINUTE,
  MarkTone,
  RUN_MARKS,
  RUN_WORDS,
  RunShownState,
  UNKNOWN_MARK,
  firstLine,
  lasted,
  minutesSeconds,
  money,
} from './run-words';
import { RunSummary, RunsReport, isEndedState } from './runs.types';

/** Within this of its limit, a live run's timer says how long is left. */
export const LATE_MS = 5 * MS_PER_MINUTE;

const hhmm = (ms: number): string => toClockFace(new Date(ms)).hoursMinutes;

/** How long `run` has gone on, or went on. */
export const elapsedOf = (run: RunRecord, now: number): number =>
  Math.max(0, (run.endedAt() ?? now) - run.startedAt);

/** The dock's head for the run on show. */
export interface DockHead {
  readonly name: string;
  readonly prompt: string;
  readonly folder: string;
  readonly state: RunShownState;
  readonly stateWord: string;
  /** Cancel run shows only for the followed run while it is live. */
  readonly canCancel: boolean;
  readonly isStopping: boolean;
  /** Hide folds a live run into the pill; Close lets a finished one go. */
  readonly hideLabel: 'Hide' | 'Close';
  /** The way back from an earlier run, or null on the followed one. */
  readonly backLabel: string | null;
}

export function dockHeadOf(view: RunRecord, followed: RunRecord | null): DockHead {
  const isPast = view !== followed;
  const isLive = followed?.isLive() ?? false;
  const state = view.shownState();
  return {
    name: isPast ? `${view.name} · earlier run, ${hhmm(view.startedAt)}` : view.name,
    prompt: view.prompt,
    folder: view.folder,
    state,
    stateWord: RUN_WORDS[state],
    canCancel: !isPast && isLive,
    isStopping: view.state() === 'stopping',
    hideLabel: isLive ? 'Hide' : 'Close',
    backLabel:
      !isPast || !followed ? null : isLive ? 'Back to the current run' : 'Back to the last run',
  };
}

/** A start this quiet for this long says why. */
export const SLOW_START_MS = 3000;

/** The line under the prompt: a slow start while the followed run is still
 *  starting, else the run's own note. */
export function noteOf(view: RunRecord, followed: RunRecord | null, now: number): RunNote | null {
  const ms = elapsedOf(view, now);
  const isSlow = view === followed && view.state() === 'starting' && ms >= SLOW_START_MS;
  return isSlow ? { text: slowStartNote(ms), isBad: false, action: null } : view.note();
}

export interface RunTimer {
  readonly text: string;
  readonly isLate: boolean;
}

/** "03:12 of 30:00", and the minutes left once a live run is near its limit. */
export function timerOf(view: RunRecord, isFollowedLive: boolean, now: number): RunTimer {
  const ms = elapsedOf(view, now);
  const left = view.limitMs - ms;
  const isLate = isFollowedLive && left <= LATE_MS;
  const late = isLate ? ` · ${Math.max(1, Math.ceil(left / MS_PER_MINUTE))} min left` : '';
  return { text: `${minutesSeconds(ms)} of ${minutesSeconds(view.limitMs)}${late}`, isLate };
}

export type FlagTone = 'plain' | 'refused' | 'cost';

export interface RunFlag {
  readonly text: string;
  readonly tone: FlagTone;
}

/** Under the title: Thinking… while it thinks, how many tools were refused,
 *  and the cost once the run reports it. */
export function flagsOf(view: RunRecord, isFollowedLive: boolean): readonly RunFlag[] {
  const facts = view.facts();
  const cost = facts.costUsd ?? view.result()?.costUsd ?? null;
  const flags: RunFlag[] = [];
  if (facts.isThinking && isFollowedLive) flags.push({ text: 'Thinking…', tone: 'plain' });
  if (facts.refused) flags.push({ text: `${facts.refused} refused`, tone: 'refused' });
  if (cost !== null) flags.push({ text: money(cost), tone: 'cost' });
  return flags;
}

/** The pill in the top bar while the dock is folded away. */
export interface RunPill {
  readonly text: string;
  readonly label: string;
  /** No task running, only earlier ones to read: the pill steps back. */
  readonly isPast: boolean;
}

/** The followed run's state and time, or, with none, the way to the runs the
 *  runner still has; null when there is neither. */
export function pillOf(followed: RunRecord | null, recent: number, now: number): RunPill | null {
  if (followed) {
    const text = `${RUN_WORDS[followed.shownState()]} · ${minutesSeconds(elapsedOf(followed, now))}`;
    return { text, label: `Claude Code task: ${text}. Show it`, isPast: !followed.isLive() };
  }
  if (!recent) return null;
  return {
    text: `Recent runs · ${recent}`,
    label: `Recent Claude Code tasks: ${recent}. Show them`,
    isPast: true,
  };
}

/** One row of Recent runs. */
export interface RecentRow {
  readonly id: string;
  readonly mark: string;
  readonly tone: MarkTone;
  readonly time: string;
  readonly prompt: string;
  readonly meta: string;
  readonly label: string;
  readonly isShown: boolean;
}

/** What a row is made from: a run from the runner's list, or the followed one. */
interface RunLine {
  readonly id: string;
  readonly prompt: string;
  readonly state: RunShownState;
  readonly startedAt: number;
  readonly endedAt: number | null;
  readonly costUsd: number | null;
}

const summaryLine = (summary: RunSummary): RunLine => ({
  ...summary,
  state: summary.state === 'done' && summary.result?.error ? 'errored' : summary.state,
  costUsd: summary.result?.costUsd ?? null,
});

const recordLine = (record: RunRecord): RunLine => ({
  id: record.id,
  prompt: record.prompt,
  state: record.shownState(),
  startedAt: record.startedAt,
  endedAt: record.endedAt(),
  costUsd: record.result()?.costUsd ?? record.facts().costUsd,
});

function rowOf(line: RunLine, shownId: string | null): RecentRow {
  const isLive = !isEndedState(line.state);
  const { mark, tone } = isLive ? LIVE_MARK : (RUN_MARKS[line.state] ?? UNKNOWN_MARK);
  const meta = [
    RUN_WORDS[line.state],
    line.endedAt !== null ? lasted(line.endedAt - line.startedAt) : '',
    line.costUsd !== null ? money(line.costUsd) : '',
  ]
    .filter(Boolean)
    .join(' · ');
  const time = isLive ? 'now' : hhmm(line.startedAt);
  const prompt = firstLine(line.prompt);
  return {
    id: line.id,
    mark,
    tone,
    time,
    prompt,
    meta,
    label: `${isLive ? 'Running now' : `Started ${time}`}: ${prompt}. ${meta}.`,
    isShown: line.id === shownId,
  };
}

/** Recent runs: the current run first, then the finished ones, newest first.
 *  The followed run's own state is newer than the list's. */
export function recentRowsOf(
  report: RunsReport,
  followed: RunRecord | null,
  shownId: string | null,
): readonly RecentRow[] {
  const summaries = [report.current, ...report.recent].filter((run) => run !== null);
  const lines = summaries.map((summary) =>
    summary.id === followed?.id ? recordLine(followed) : summaryLine(summary),
  );
  if (followed && !lines.some((line) => line.id === followed.id))
    lines.unshift(recordLine(followed));
  return lines.map((line) => rowOf(line, shownId));
}
