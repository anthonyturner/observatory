import {
  type LaunchContext,
  NODE_CONTEXT,
  type RunProcess,
  asRunProcess,
  withoutCredentials,
} from '../runner/claude-launcher.ts';

/** Starts one shell line in a folder, telling the server to listen on `port`. */
export type DevLaunch = (folder: string, command: string, port: number) => RunProcess;

/** Switches off what would make a server wait for an answer nobody is there to give. */
const UNATTENDED_ENV: NodeJS.ProcessEnv = {
  /** Angular's first-run question about sharing usage data. */
  NG_CLI_ANALYTICS: 'false',
  /** Create React App opens a browser window of its own. */
  BROWSER: 'none',
};

/**
 * Starts a dev server through the shell, as typing the line in a terminal
 * there would, without the API's own credentials, and with `PORT` set. The
 * line is the owner's (run.json) or one of two fixed npm commands, never text
 * from a request. Its stdin stays an open pipe, never closed: Vite, among
 * others, quits when its stdin ends.
 */
export function shellLauncher(context: LaunchContext = NODE_CONTEXT): DevLaunch {
  return (folder, command, port) =>
    asRunProcess(
      context.spawn(command, [], {
        cwd: folder,
        env: { ...withoutCredentials(context.env), ...UNATTENDED_ENV, PORT: String(port) },
        shell: true,
        windowsHide: true,
        // Its own process group elsewhere, so a kill reaches its children too.
        detached: context.platform !== 'win32',
        stdio: ['pipe', 'pipe', 'pipe'],
      }),
    );
}
