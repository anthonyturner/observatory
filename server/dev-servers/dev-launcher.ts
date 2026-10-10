import {
  type LaunchContext,
  NODE_CONTEXT,
  type RunProcess,
  asRunProcess,
  withoutCredentials,
} from '../runner/claude-launcher.ts';

/** Starts one shell line in a folder. */
export type DevLaunch = (folder: string, command: string) => RunProcess;

/**
 * Starts a dev server through the shell, as typing the line in a terminal
 * there would, without the API's own credentials. The line is the owner's
 * (run.json) or one of two fixed npm commands, never text from a request.
 * Its stdin stays an open pipe, never closed: Vite, among others, quits when
 * its stdin ends.
 */
export function shellLauncher(context: LaunchContext = NODE_CONTEXT): DevLaunch {
  return (folder, command) =>
    asRunProcess(
      context.spawn(command, [], {
        cwd: folder,
        env: withoutCredentials(context.env),
        shell: true,
        windowsHide: true,
        // Its own process group elsewhere, so a kill reaches its children too.
        detached: context.platform !== 'win32',
        stdio: ['pipe', 'pipe', 'pipe'],
      }),
    );
}
