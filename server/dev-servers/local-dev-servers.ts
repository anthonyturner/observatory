import type { CloneFinder } from '../collisions/clone-finder.ts';
import { type ProjectRef, cloneCheckouts } from '../runner/checkouts.ts';
import { processTreeKiller } from '../runner/process-tree.ts';
import { shellLauncher } from './dev-launcher.ts';
import { DevServers } from './dev-servers.ts';
import { fileRunCommands } from './run-command.ts';

/** What the local server knows that its dev servers are built from. */
export interface LocalDevServerSources {
  readonly projects: () => Promise<readonly ProjectRef[]>;
  readonly clones: CloneFinder;
}

/** The dev servers on this machine: shell commands, in the projects' clones. */
export function localDevServers(sources: LocalDevServerSources): DevServers {
  return new DevServers({
    checkouts: cloneCheckouts(sources.projects, sources.clones),
    commands: fileRunCommands(),
    launch: shellLauncher(),
    killer: processTreeKiller(),
    later: (run, ms) => {
      const timer = setTimeout(run, ms);
      timer.unref();
      return () => clearTimeout(timer);
    },
  });
}
