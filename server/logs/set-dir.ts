import { existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { repoNameFrom } from '../queue/repo-name.ts';
import { LOGS_CONFIG_FILE, fileLogsConfig } from './logs-config.ts';

// Records which log folder a repository's Log Sky reads:
//   node server/logs/set-dir.ts owner/repo "C:\Users\you\AppData\Local\Overwolf\Log\Apps\Your App"

const USAGE = 'Usage: node server/logs/set-dir.ts owner/repo "<log folder>"';

function main([repoArgument, folderArgument]: readonly string[]): void {
  if (!repoArgument || !folderArgument) throw new Error(USAGE);
  const repo = repoNameFrom(repoArgument);
  const folder = resolve(folderArgument);
  if (!existsSync(folder) || !statSync(folder).isDirectory()) {
    throw new Error(`Log folder not found: ${folder}`);
  }
  fileLogsConfig().setFolder(repo, folder);
  console.log(`${repo} reads its logs from ${folder} (recorded in ${LOGS_CONFIG_FILE}).`);
}

try {
  main(process.argv.slice(2));
} catch (error: unknown) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
