import type { RunProcess } from './claude-launcher.ts';
import { readLines } from './line-reader.ts';
import type { RunLog } from './run-log.ts';

/** What the run list shows of Claude Code's closing `result` event, so it can
 *  give each run's cost without reading its whole output again. */
export interface RunResult {
  readonly error: boolean;
  readonly subtype: string | null;
  readonly costUsd: number | null;
  readonly turns: number | null;
  readonly durationMs: number | null;
}

/** What a run hears from its output, besides the log. */
export interface OutputListener {
  /** Claude Code wrote something: it has got past the owner's start-up hooks. */
  heard(): void;
  finished(result: RunResult): void;
}

type Fields = Readonly<Record<string, unknown>>;

const finiteOrNull = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

export const resultOf = (event: Fields): RunResult => ({
  error: event['is_error'] === true,
  subtype: typeof event['subtype'] === 'string' ? event['subtype'] : null,
  costUsd: finiteOrNull(event['total_cost_usd']),
  turns: finiteOrNull(event['num_turns']),
  durationMs: finiteOrNull(event['duration_ms']),
});

const isResult = (event: unknown): event is Fields =>
  typeof event === 'object' && event !== null && (event as Fields)['type'] === 'result';

/** A line of stream-json, or undefined when it is not JSON. */
function parsed(line: string): unknown {
  try {
    return JSON.parse(line) as unknown;
  } catch {
    return undefined;
  }
}

function recordLine(line: string, log: RunLog, listener: OutputListener): void {
  if (!line.trim()) return;
  listener.heard();
  const event = parsed(line);
  if (event === undefined) return log.append('text', line);
  if (isResult(event)) listener.finished(resultOf(event));
  log.append('claude', event);
}

/** Writes what `process` prints into `log`, each line kept to `lineBytes`. */
export function recordOutput(
  process: RunProcess,
  log: RunLog,
  lineBytes: number,
  listener: OutputListener,
): void {
  readLines(process.stdout, lineBytes, {
    onLine: (line) => recordLine(line, log, listener),
    onOverlong: (head, size) => {
      listener.heard();
      log.append('cut', { head, size });
    },
  });
  readLines(process.stderr, lineBytes, {
    onLine: (line) => {
      if (line) log.append('stderr', line);
    },
    onOverlong: (head) => log.append('stderr', head),
  });
}
