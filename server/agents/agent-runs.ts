/* One finished subagent run, read from the transcript and metadata Claude Code
   leaves under each session's `subagents/` folder:

     <session>/subagents/agent-<id>.jsonl       the run's own transcript
     <session>/subagents/agent-<id>.meta.json   its agent type and description

   Claude Code calls both formats internal, so every field is optional: a
   changed format shows as a gap or "unknown", never as a wrong number. */

import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname } from 'node:path';
import { mergeReports, messageOf, sessionLogFiles } from '../usage/session-log.ts';
import { workTokens } from '../usage/token-days.ts';
import type { AssistantMessage } from '../usage/usage-types.ts';

/** A run's tokens by kind, each reply counted once. */
export interface RunTokens {
  readonly input: number;
  readonly output: number;
  readonly cacheRead: number;
  readonly cacheWrite: number;
}

/** A run as its files tell it, before its folder is matched to a project. */
export interface RawAgentRun {
  readonly id: string;
  /** As Claude Code named it, namespace and all: `agent-playbook:dev`, `Explore`. */
  readonly agentType: string | null;
  readonly description: string;
  readonly session: string;
  readonly cwd: string;
  readonly branch: string | null;
  readonly startedAt: number;
  readonly endedAt: number;
  readonly model: string | null;
  readonly toolUses: number;
  readonly tokens: RunTokens;
  /** Input, output and cache writes: the tokens the usage view counts as work. */
  readonly workTokens: number;
  /** The fullest single request of the run: its input, cache reads and cache writes. */
  readonly peakContext: number;
}

interface Meta {
  readonly agentType?: unknown;
  readonly description?: unknown;
}

interface LineHead {
  readonly timestamp?: unknown;
  readonly gitBranch?: unknown;
  readonly sessionId?: unknown;
  readonly cwd?: unknown;
}

const text = (value: unknown): string => (typeof value === 'string' ? value : '');

/** The context one request carried: everything read in, cached or not. */
export const contextOf = (message: AssistantMessage): number =>
  message.input + message.cacheRead + message.cacheWrite;

/** The model that answered most of the run's replies. */
function mainModel(messages: readonly AssistantMessage[]): string | null {
  const counts = new Map<string, number>();
  for (const message of messages) counts.set(message.model, (counts.get(message.model) ?? 0) + 1);
  let best: string | null = null;
  for (const [model, count] of counts) if (!best || count > (counts.get(best) ?? 0)) best = model;
  return best;
}

/** A run from its metadata and transcript lines, or null when no reply was recorded. */
export function runOf(
  id: string,
  metaJson: string | null,
  lines: readonly string[],
): RawAgentRun | null {
  let meta: Meta = {};
  try {
    meta = metaJson ? (JSON.parse(metaJson) as Meta) : {};
  } catch {
    meta = {};
  }
  const byId = new Map<string, AssistantMessage>();
  let startedAt = Infinity;
  let endedAt = -Infinity;
  let branch = '';
  let session = '';
  let cwd = '';
  for (const line of lines) {
    let head: LineHead;
    try {
      head = JSON.parse(line) as LineHead;
    } catch {
      continue;
    }
    const at = Date.parse(text(head?.timestamp));
    if (Number.isFinite(at)) {
      startedAt = Math.min(startedAt, at);
      endedAt = Math.max(endedAt, at);
    }
    branch ||= text(head?.gitBranch);
    session ||= text(head?.sessionId);
    cwd ||= text(head?.cwd);
    const message = messageOf(line);
    if (!message) continue;
    const earlier = byId.get(message.id);
    byId.set(message.id, earlier ? mergeReports(earlier, message) : message);
  }
  const messages = [...byId.values()];
  if (!messages.length) return null;
  const sum = (pick: (message: AssistantMessage) => number): number =>
    messages.reduce((total, message) => total + pick(message), 0);
  return {
    id,
    agentType: text(meta.agentType) || null,
    description: text(meta.description),
    session,
    cwd,
    branch: branch || null,
    startedAt,
    endedAt,
    model: mainModel(messages),
    toolUses: sum((message) => message.tools.length),
    tokens: {
      input: sum((message) => message.input),
      output: sum((message) => message.output),
      cacheRead: sum((message) => message.cacheRead),
      cacheWrite: sum((message) => message.cacheWrite),
    },
    workTokens: sum(workTokens),
    peakContext: Math.max(...messages.map(contextOf)),
  };
}

const AGENT_FILE = /^agent-(.+)\.jsonl$/;

/** Every subagent transcript under `logsDir`, with its id. */
export function* agentTranscripts(logsDir: string): Generator<{ id: string; file: string }> {
  for (const file of sessionLogFiles(logsDir)) {
    const match = AGENT_FILE.exec(basename(file));
    if (match && basename(dirname(file)) === 'subagents') yield { id: match[1], file };
  }
}

/** Bump when the cached shape changes, so an old cache is read afresh. */
const CACHE_VERSION = 1;

interface CachedRun {
  /** Size and modification time of transcript and metadata together. */
  readonly key: string;
  readonly run: RawAgentRun | null;
}

interface CacheFile {
  readonly version: number;
  readonly runs: Readonly<Record<string, CachedRun>>;
}

/** Reads and writes the run cache; a test keeps it in memory. */
export interface RunCache {
  read(): Readonly<Record<string, CachedRun>>;
  write(runs: Record<string, CachedRun>): void;
}

const keyOf = (path: string): string | null => {
  try {
    const stats = statSync(path);
    return `${stats.size}-${Math.floor(stats.mtimeMs)}`;
  } catch {
    return null;
  }
};

const readText = (path: string): string | null => {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return null;
  }
};

/** Every run whose transcript changed since `from`. Only files changed since
 *  the last call are read again. */
export function runsSince(logsDir: string, from: number, cache: RunCache): RawAgentRun[] {
  const cached = cache.read();
  const next: Record<string, CachedRun> = {};
  for (const { id, file } of agentTranscripts(logsDir)) {
    let modified: number;
    try {
      modified = statSync(file).mtimeMs;
    } catch {
      continue;
    }
    if (modified < from) continue;
    const metaFile = file.replace(/\.jsonl$/, '.meta.json');
    const key = `${keyOf(file)}|${keyOf(metaFile)}`;
    const had = cached[file];
    if (had?.key === key) {
      next[file] = had;
      continue;
    }
    const lines = (readText(file) ?? '').split('\n').filter(Boolean);
    next[file] = { key, run: runOf(id, readText(metaFile), lines) };
  }
  cache.write(next);
  return Object.values(next).flatMap(({ run }) => (run ? [run] : []));
}

/** The cache as a JSON file beside the usage view's own. */
export function fileRunCache(path: string): RunCache {
  return {
    read: () => {
      try {
        const cache = JSON.parse(readFileSync(path, 'utf8')) as CacheFile;
        return cache.version === CACHE_VERSION ? cache.runs : {};
      } catch {
        return {};
      }
    },
    write: (runs) => {
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, JSON.stringify({ version: CACHE_VERSION, runs }), 'utf8');
    },
  };
}
