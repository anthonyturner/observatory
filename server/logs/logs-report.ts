import type { LogClears } from './log-clears.ts';
import type { LogFolder } from './log-folder.ts';
import { readLogSnapshot } from './log-folder.ts';
import type { LogsConfig } from './logs-config.ts';
import type { LogSnapshot, LogsUnconfigured } from './log-types.ts';

/** Where a repository's Log Sky comes from: which folder, the folder itself, and when it was cleared. */
export interface LogSources {
  readonly config: LogsConfig;
  readonly folder: LogFolder;
  readonly clears: LogClears;
}

/** One repository's Log Sky, or why it has none. Logs are optional, so a
 *  missing folder is an answer, not an error. */
export async function logsReport(
  sources: LogSources,
  repo: string,
  now: Date,
): Promise<LogSnapshot | LogsUnconfigured> {
  const dir = sources.config.folderOf(repo);
  if (!dir) return { configured: false, reason: 'not-set' };
  if (!sources.folder.exists(dir)) return { configured: false, reason: 'not-found' };
  return readLogSnapshot(sources.folder, dir, {
    now,
    clearedAt: await sources.clears.clearedAt(repo),
  });
}
