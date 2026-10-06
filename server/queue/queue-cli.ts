/* The review queue in a terminal, as pr-starmap's /queue had it: the same
   blocked-first queue the star map shows, and seen, dismiss, snooze, restore
   and look on one pull request. It reads GitHub through gh and keeps triage
   in the same store the local site uses, so either one sees what the other did.

     npm run queue -- [owner/repo] [all | seen <pr> | unseen <pr> | dismiss <pr> | snooze <pr> <days> | restore <pr> | look <pr>] [--json]

   With no repository it takes the one the current checkout's origin points at.
   Triage only: it never merges, closes or pushes. */

import { execFileSync } from 'node:child_process';
import { ghCliReader } from '../github/gh-cli-reader.ts';
import { fileStore } from '../store/file-store.ts';
import { storeTriageStore } from '../triage/triage-store.ts';
import { recordTriage, withTriage } from '../triage/triaged-queue.ts';
import { queueReport } from './queue-report.ts';
import { actedLine, parseQueueArgs, renderQueue, repoFromRemote } from './queue-text.ts';

/** The checkout the command was run from: npm runs scripts from the package's own folder. */
function originRepo(): string | null {
  try {
    const url = execFileSync('git', ['remote', 'get-url', 'origin'], {
      cwd: process.env['INIT_CWD'] ?? process.cwd(),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return repoFromRemote(url);
  } catch {
    return null;
  }
}

async function main(): Promise<void> {
  const args = parseQueueArgs(process.argv.slice(2));
  const repo = args.repo ?? originRepo();
  if (!repo)
    throw new Error('Name the repository (owner/repo), or run this inside a GitHub checkout.');
  const triage = storeTriageStore(fileStore());
  const report = await queueReport(ghCliReader(), repo);
  const now = Date.now();
  if (args.command.kind === 'show') {
    const queue = await withTriage(report, triage, now);
    console.log(args.json ? JSON.stringify(queue, null, 2) : renderQueue(queue, args.command.all));
    return;
  }
  const { action, number, days } = args.command;
  const result = await recordTriage({ repo, number, action, days }, report, triage, now);
  console.log(args.json ? JSON.stringify(result) : actedLine(action, number, result));
}

if (process.argv[1]?.replace(/\\/g, '/').endsWith('queue/queue-cli.ts')) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
