import { createReadStream, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import type { AssistantMessage } from './usage-types.ts';

// Claude Code calls its session-log format internal, so every field is read
// as optional: a changed format shows as a gap, never as a wrong number.

/** Every `.jsonl` log under `dir`, however deep. */
export function* sessionLogFiles(dir: string): Generator<string> {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* sessionLogFiles(path);
    else if (entry.name.endsWith('.jsonl')) yield path;
  }
}

const count = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : 0;

interface LogLine {
  readonly type?: unknown;
  readonly timestamp?: unknown;
  readonly message?: {
    readonly id?: unknown;
    readonly model?: unknown;
    readonly usage?: Record<string, unknown>;
  };
}

/** The assistant message a log line carries, or null for any other line. */
export function messageOf(line: string): AssistantMessage | null {
  let entry: LogLine;
  try {
    entry = JSON.parse(line) as LogLine;
  } catch {
    return null;
  }
  const message = entry?.message;
  const usage = message?.usage;
  const { id, model } = message ?? {};
  // A model in angle brackets is Claude Code's own placeholder, not a reply.
  if (entry.type !== 'assistant' || typeof id !== 'string' || !usage) return null;
  if (typeof model !== 'string' || !model || model.startsWith('<')) return null;
  const at = Date.parse(String(entry.timestamp));
  if (!Number.isFinite(at)) return null;
  return {
    id,
    at,
    model,
    input: count(usage['input_tokens']),
    output: count(usage['output_tokens']),
    cacheRead: count(usage['cache_read_input_tokens']),
    cacheWrite: count(usage['cache_creation_input_tokens']),
  };
}

/** Of two reports of one reply, each count at its largest: a streamed reply
 *  repeats its usage, growing as it goes. */
export function mergeReports(a: AssistantMessage, b: AssistantMessage): AssistantMessage {
  return {
    ...a,
    input: Math.max(a.input, b.input),
    output: Math.max(a.output, b.output),
    cacheRead: Math.max(a.cacheRead, b.cacheRead),
    cacheWrite: Math.max(a.cacheWrite, b.cacheWrite),
  };
}

/** A log file's assistant messages, each reply once. */
export async function messagesIn(file: string): Promise<AssistantMessage[]> {
  const byId = new Map<string, AssistantMessage>();
  const lines = createInterface({ input: createReadStream(file, 'utf8'), crlfDelay: Infinity });
  for await (const line of lines) {
    // Most lines are tool results and attachments; skip them before parsing.
    if (!line.includes('"assistant"')) continue;
    const message = messageOf(line);
    if (!message) continue;
    const earlier = byId.get(message.id);
    byId.set(message.id, earlier ? mergeReports(earlier, message) : message);
  }
  return [...byId.values()];
}
