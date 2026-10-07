import {
  type TranscriptLine,
  blocksOf,
  isBlock,
  parseLine,
  text,
  textsOf,
  timeOf,
} from './transcript-lines.ts';

/** The answers a transcript records: what tells a spawner's subagent has finished. */
export interface Answers {
  /** Tool calls that have their answer, by call id, with when it came. */
  readonly calls: ReadonlyMap<string, number>;
  /** Background tasks reported done, by task id, with when the report came. */
  readonly tasks: ReadonlyMap<string, number>;
}

/** A background subagent's call is answered at once, while the subagent keeps running. */
const ASYNC_LAUNCHED = 'async_launched';
const TASK_NOTICE = /<task-id>([^<]+)<\/task-id>[\s\S]*?<status>([^<]+)<\/status>/g;
const FINAL_STATUSES = new Set(['completed', 'failed', 'killed', 'stopped', 'cancelled']);
/** Every line that can hold an answer carries one of these; the rest are not parsed. */
const ANSWER_HINTS = ['"tool_result"', '<task-id>'];

const isAsyncLaunch = (result: unknown): boolean =>
  isBlock(result) && (result['status'] === ASYNC_LAUNCHED || result['isAsync'] === true);

/** The later of two answers to one id, so a resumed and finished-again agent counts once more. */
function keepLatest(into: Map<string, number>, id: string, at: number): void {
  into.set(id, Math.max(into.get(id) ?? at, at));
}

function takeCalls(line: TranscriptLine, at: number, calls: Map<string, number>): void {
  if (line.type !== 'user' || isAsyncLaunch(line.toolUseResult)) return;
  for (const block of blocksOf(line.message?.content)) {
    const call = text(block['tool_use_id']);
    if (block['type'] === 'tool_result' && call) keepLatest(calls, call, at);
  }
}

function takeTasks(line: TranscriptLine, at: number, tasks: Map<string, number>): void {
  for (const said of [...textsOf(line.content), ...textsOf(line.message?.content)]) {
    for (const [, task, status] of said.matchAll(TASK_NOTICE)) {
      if (FINAL_STATUSES.has(status.trim())) keepLatest(tasks, task.trim(), at);
    }
  }
}

/** One transcript's answers, added to as more of it is read. */
export class AnswerBook implements Answers {
  readonly calls = new Map<string, number>();
  readonly tasks = new Map<string, number>();

  /** Adds the answers `lines` record. A line with no time is taken as written
   *  with the one before it. */
  add(lines: readonly string[]): void {
    let at = 0;
    for (const line of lines) {
      if (!ANSWER_HINTS.some((hint) => line.includes(hint))) continue;
      const parsed = parseLine(line);
      if (!parsed) continue;
      at = timeOf(parsed) ?? at;
      takeCalls(parsed, at, this.calls);
      takeTasks(parsed, at, this.tasks);
    }
  }
}

/** Every answer in `all`, the latest per id. */
export function mergedAnswers(all: readonly Answers[]): Answers {
  const merged = { calls: new Map<string, number>(), tasks: new Map<string, number>() };
  for (const { calls, tasks } of all) {
    for (const [id, at] of calls) keepLatest(merged.calls, id, at);
    for (const [id, at] of tasks) keepLatest(merged.tasks, id, at);
  }
  return merged;
}
