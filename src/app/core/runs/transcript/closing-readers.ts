import { Json, fieldOf, isNumber, isObject, oneOf } from '../../json/json-fields';
import { toClockFace } from '../../time/clock-format';
import { lasted, money } from '../run-words';
import { RUN_STATES, RunState, isEndedState } from '../runs.types';
import { EventReader, TranscriptContext, quietLine, warningLine } from './transcript-context';

const MS_PER_SECOND = 1000;

const LIMIT_WINDOWS: Readonly<Record<string, string>> = {
  five_hour: 'five-hour',
  seven_day: 'weekly',
  seven_day_opus: 'weekly Opus',
  seven_day_sonnet: 'weekly Sonnet',
};

const RESULT_WHY: Readonly<Record<string, string>> = {
  error_max_turns: 'it reached its turn limit',
  error_during_execution: 'something failed while it ran',
  error_max_budget_usd: 'it reached its spending limit',
};

const STOPPING_WHY: Readonly<Record<string, string>> = {
  'time-limit': 'the time limit was reached',
  shutdown: 'the local site is shutting down',
};

/** The line each of the runner's own states adds; the rest add none. */
const STATE_LINES: Partial<Readonly<Record<RunState, (data: Json) => string>>> = {
  stopping: (data) => `Stopping: ${STOPPING_WHY[String(data['stopping'])] ?? 'cancelled'}.`,
  cancelled: () => 'Run cancelled.',
  'time-limit': () => 'Run stopped at its time limit.',
  shutdown: () => 'Run stopped: the local site shut down.',
  failed: (data) => `Run failed${data['why'] ? `: ${String(data['why'])}` : ''}.`,
};

const hhmm = (ms: number): string => toClockFace(new Date(ms)).hoursMinutes;

function resultFacts(data: Json, costUsd: number | null): string[] {
  const turns = data['num_turns'];
  return [
    isNumber(data['duration_ms']) ? lasted(data['duration_ms']) : '',
    costUsd !== null ? money(costUsd) : '',
    isNumber(turns) ? `${turns} turn${turns === 1 ? '' : 's'}` : '',
  ].filter(Boolean);
}

function resultLines(data: Json, isBad: boolean): string[] {
  const subtype = typeof data['subtype'] === 'string' ? data['subtype'] : null;
  const why = subtype ? (RESULT_WHY[subtype] ?? `of ${subtype}`) : 'of an error';
  const errors = Array.isArray(data['errors']) ? data['errors'].map(String).join('\n') : '';
  return [
    isBad ? `Claude Code stopped because ${why}.` : '',
    typeof data['result'] === 'string' ? data['result'].trim() : '',
    errors,
  ].filter(Boolean);
}

/** The run's own verdict: what it came to, how long, what it cost. */
export const readResult: EventReader = (context, data) => {
  context.think(false);
  const isBad = data['is_error'] === true || String(data['subtype'] ?? '').startsWith('error');
  const costUsd = isNumber(data['total_cost_usd']) ? data['total_cost_usd'] : null;
  context.conclude(isBad, costUsd);
  const facts = resultFacts(data, costUsd);
  const heading = `${isBad ? '✕ Stopped with an error' : '✓ Done'}${facts.length ? ` · ${facts.join(' · ')}` : ''}`;
  context.list.add({ kind: 'result', isBad, heading, lines: resultLines(data, isBad) });
};

/** Hidden while the owner's plan allows the run; one quiet line when it is
 *  near a limit or at it, once for each. */
export const readRateLimit: EventReader = (context, data) => {
  const info = isObject(data['rate_limit_info']) ? data['rate_limit_info'] : null;
  if (!info || info['status'] === 'allowed') return;
  const key = `${String(info['status'])}/${String(info['rateLimitType'])}`;
  if (context.hasWarned(key)) return;
  context.markWarned(key);
  const window = LIMIT_WINDOWS[String(info['rateLimitType'])] ?? 'usage';
  const resetsAt = info['resetsAt'];
  const at = isNumber(resetsAt) ? `; it resets at ${hhmm(resetsAt * MS_PER_SECOND)}` : '';
  context.list.add(
    warningLine(
      info['status'] === 'rejected'
        ? `Your ${window} limit is used up${at}. The run may stop here.`
        : `Close to your ${window} limit${at}.`,
    ),
  );
};

export const readSessionStart: EventReader = (context, data) => {
  const model = data['model'] ? ` · ${String(data['model'])}` : '';
  context.list.add(
    quietLine(`Session started${model} · in ${String(data['cwd'] ?? context.folder)}`),
  );
};

/** The runner's own state lines round Claude Code's output. */
export function readState(context: TranscriptContext, data: Json): void {
  const state = fieldOf(data, 'state', oneOf(RUN_STATES));
  if (!state) return;
  if (state === 'stopping' || isEndedState(state)) context.think(false);
  const line = STATE_LINES[state]?.(data);
  const why = data['why'] && state !== 'failed' ? ` ${String(data['why'])}` : '';
  if (line) context.list.add(quietLine(`${line}${why}`));
}
