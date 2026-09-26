import { constants } from 'node:os';
import type { CloneFinder } from '../collisions/clone-finder.ts';
import { claudeLauncher } from './claude-launcher.ts';
import type { ClaudeCommand } from './claude-command.ts';
import { type ProjectRef, cloneCheckouts } from './checkouts.ts';
import { processTreeKiller } from './process-tree.ts';
import { Runner } from './runner.ts';

/** What the local server knows that a runner is built from. */
export interface LocalRunnerSources {
  readonly claude: ClaudeCommand | null;
  readonly projects: () => Promise<readonly ProjectRef[]>;
  readonly clones: CloneFinder;
}

/** Ctrl+C, a closed console window (SIGHUP on Windows), Ctrl+Break, or a stop. */
const EXIT_SIGNALS = ['SIGINT', 'SIGTERM', 'SIGHUP', 'SIGBREAK'] as const;
/** A process ended by a signal exits with 128 plus the signal's number, by convention. */
const SIGNAL_EXIT_BASE = 128;

/** The runner on this machine: Claude Code from the PATH, in the projects' clones. */
export function localRunner(sources: LocalRunnerSources): Runner {
  return new Runner({
    launch: claudeLauncher(sources.claude),
    killer: processTreeKiller(),
    checkouts: cloneCheckouts(sources.projects, sources.clones),
    clock: Date.now,
  });
}

/** A run would outlive this process unless it is killed on the way out, so every
 *  way out goes through `exit`, where the runner kills it. */
export function shutDownWithProcess(runner: Runner): void {
  process.on('exit', () => runner.shutdown());
  for (const signal of EXIT_SIGNALS) {
    const number = constants.signals[signal];
    if (number) process.on(signal, () => process.exit(SIGNAL_EXIT_BASE + number));
  }
}
