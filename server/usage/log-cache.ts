import { changedSince, jsonEntryStore, fileKey, valuesPerFile } from './file-cache.ts';
import { messagesIn, sessionLogFiles } from './session-log.ts';
import type { AssistantMessage } from './usage-types.ts';

/** Bump when the cached shape changes, so an old cache is read afresh. */
const CACHE_VERSION = 3;

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
  const files = await changedSince([...sessionLogFiles(logsDir)], from);
  const perFile = await valuesPerFile<readonly AssistantMessage[]>(
    files,
    jsonEntryStore(cachePath, CACHE_VERSION),
    fileKey,
    messagesIn,
  );

  const byId = new Map<string, AssistantMessage>();
  for (const messages of perFile.values()) {
    for (const message of messages) {
      if (message.at >= from && !byId.has(message.id)) byId.set(message.id, message);
    }
  }
  return [...byId.values()];
}
