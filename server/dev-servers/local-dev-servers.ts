import type { CloneFinder } from '../collisions/clone-finder.ts';
import { type ProjectRef, cloneCheckouts } from '../runner/checkouts.ts';
import { processTreeKiller } from '../runner/process-tree.ts';
import { shellLauncher } from './dev-launcher.ts';
import { freeLoopbackPort } from './dev-port.ts';
import { DevServers } from './dev-servers.ts';
import { PullWorktrees } from './pull-worktrees.ts';
import { fileRunCommands } from './run-command.ts';
import { answersHttp } from './site-probe.ts';
import { toolRunner } from './tool-runner.ts';
import { localWorkspaces } from './workspace.ts';
import { nodeWorktreeFiles } from './worktree-files.ts';

/** What the local server knows that its dev servers are built from. */
export interface LocalDevServerSources {
  readonly projects: () => Promise<readonly ProjectRef[]>;
  readonly clones: CloneFinder;
  /** Whether a pull request is still open. */
  readonly isPullOpen: (repo: string, pull: number) => Promise<boolean>;
}

/** The dev servers on this machine: shell commands, in the projects' clones and the worktrees of their pull requests. */
export function localDevServers(sources: LocalDevServerSources): DevServers {
  return new DevServers({
    checkouts: cloneCheckouts(sources.projects, sources.clones),
    commands: fileRunCommands(),
    workspaces: localWorkspaces(
      new PullWorktrees({
        tools: toolRunner(),
        files: nodeWorktreeFiles(),
        pulls: { isOpen: sources.isPullOpen },
      }),
    ),
    launch: shellLauncher(),
    killer: processTreeKiller(),
    freePort: freeLoopbackPort,
    probe: answersHttp,
    later: (run, ms) => {
      const timer = setTimeout(run, ms);
      timer.unref();
      return () => clearTimeout(timer);
    },
  });
}
