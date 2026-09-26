import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { messagesIn, sessionLogFiles } from './session-log.ts';
import type { AssistantMessage } from './usage-types.ts';

/** Bump when the cached shape changes, so an old cache is read afresh. */
const CACHE_VERSION = 1;

interface CachedFile {
  /** Size and modification time: a file whose key is unchanged is not reread. */
  readonly key: string;
  readonly messages: readonly AssistantMessage[];
}

interface CacheFile {
  readonly version: number;
  readonly files: Readonly<Record<string, CachedFile>>;
}

function readCache(path: string): Readonly<Record<string, CachedFile>> {
  try {
    const cache = JSON.parse(readFileSync(path, 'utf8')) as CacheFile;
    return cache.version === CACHE_VERSION ? cache.files : {};
  } catch {
    return {};
  }
}

function writeCache(path: string, files: Record<string, CachedFile>): void {
  mkdirSync(dirname(path), { recursive: true });
  // Compact: pretty-printed, a month of logs' cache runs to megabytes.
  writeFileSync(path, JSON.stringify({ version: CACHE_VERSION, files }), 'utf8');
}

/**
 * Every assistant message since `from`, each reply once across all files: a
 * resumed session copies earlier messages into its new file. Only files that
 * changed since the last call are read again.
 */
export async function messagesSince(
  logsDir: string,
  from: number,
  cachePath: string,
): Promise<AssistantMessage[]> {
  const cached = readCache(cachePath);
  const next: Record<string, CachedFile> = {};
  for (const file of sessionLogFiles(logsDir)) {
    let stats;
    try {
      stats = statSync(file);
    } catch {
      continue;
    }
    if (stats.mtimeMs < from) continue;
    const key = `${stats.size}-${Math.floor(stats.mtimeMs)}`;
    next[file] =
      cached[file]?.key === key ? cached[file] : { key, messages: await messagesIn(file) };
  }
  writeCache(cachePath, next);

  const byId = new Map<string, AssistantMessage>();
  for (const { messages } of Object.values(next)) {
    for (const message of messages) {
      if (message.at >= from && !byId.has(message.id)) byId.set(message.id, message);
    }
  }
  return [...byId.values()];
}
