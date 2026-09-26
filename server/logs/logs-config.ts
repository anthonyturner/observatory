import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

/** Which log folder each repository's Log Sky reads. */
export interface LogsConfig {
  folderOf(repo: string): string | null;
  setFolder(repo: string, folder: string): void;
}

/** `{"owner/repo": "<folder>"}`: Observatory's own, never pr-starmap's. */
export const LOGS_CONFIG_FILE = join(homedir(), '.claude', 'observatory', 'logs.json');

type Folders = Record<string, string>;

function readFolders(file: string): Folders {
  let stored: unknown;
  try {
    stored = JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return {};
  }
  if (typeof stored !== 'object' || stored === null || Array.isArray(stored)) return {};
  return Object.fromEntries(
    Object.entries(stored).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string',
    ),
  );
}

/** The config in one JSON file. A missing or unreadable file reads as empty; a
 *  write keeps every other repository's folder and lands whole or not at all. */
export function fileLogsConfig(file = LOGS_CONFIG_FILE): LogsConfig {
  return {
    folderOf: (repo) => readFolders(file)[repo] ?? null,
    setFolder(repo, folder) {
      mkdirSync(dirname(file), { recursive: true });
      const staged = `${file}.tmp`;
      writeFileSync(
        staged,
        JSON.stringify({ ...readFolders(file), [repo]: folder }, null, 2),
        'utf8',
      );
      renameSync(staged, file);
    },
  };
}
