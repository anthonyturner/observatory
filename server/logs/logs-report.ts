import type { LogFolder } from './log-folder.ts';
import { readLogSnapshot } from './log-folder.ts';
import type { LogsConfig } from './logs-config.ts';
import type { LogSnapshot, LogsUnconfigured } from './log-types.ts';

/** One repository's Log Sky, or why it has none. Logs are optional, so a
 *  missing folder is an answer, not an error. */
export async function logsReport(
  config: LogsConfig,
  folder: LogFolder,
  repo: string,
  now: Date,
): Promise<LogSnapshot | LogsUnconfigured> {
  const dir = config.folderOf(repo);
  if (!dir) return { configured: false, reason: 'not-set' };
  if (!folder.exists(dir)) return { configured: false, reason: 'not-found' };
  return readLogSnapshot(folder, dir, now);
}
