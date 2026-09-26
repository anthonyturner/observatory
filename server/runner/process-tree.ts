import { execFile, execFileSync } from 'node:child_process';

/** Ends a process and every process under it. */
export interface ProcessTreeKiller {
  /** Asks the tree to stop, and elsewhere than Windows forces it a moment later. */
  stop(pid: number): void;
  /** Stops the tree before returning: for the server's `exit` handler, where
   *  nothing asynchronous runs. */
  stopNow(pid: number): void;
}

/** The system calls a killer makes; tests give their own. */
export interface KillContext {
  readonly platform: NodeJS.Platform;
  readonly taskkill: (args: readonly string[]) => void;
  readonly taskkillNow: (args: readonly string[]) => void;
  readonly signal: (pid: number, signal: NodeJS.Signals) => void;
  readonly later: (run: () => void, ms: number) => void;
}

/** SIGTERM gets this long before SIGKILL follows. */
const FORCE_AFTER_MS = 3_000;

const taskkillArgs = (pid: number): readonly string[] => ['/pid', String(pid), '/T', '/F'];

/** A process that is already gone is what a kill wanted. */
const reportUnlessGone = (error: unknown): void => {
  if ((error as NodeJS.ErrnoException | null)?.code !== 'ESRCH') {
    console.error('could not stop a run:', error);
  }
};

function signalGroup(context: KillContext, pid: number, signal: NodeJS.Signals): void {
  try {
    // The negative pid is the process group the launcher started it in.
    context.signal(-pid, signal);
  } catch (error) {
    reportUnlessGone(error);
  }
}

function taskkill(run: (args: readonly string[]) => void, pid: number): void {
  try {
    run(taskkillArgs(pid));
  } catch (error) {
    console.error('could not stop a run:', error);
  }
}

const NODE_KILL_CONTEXT: KillContext = {
  platform: process.platform,
  taskkill: (args) =>
    void execFile('taskkill', args, { windowsHide: true }, (error) => {
      // taskkill also fails when the tree ended on its own a moment earlier.
      if (error) console.error('taskkill:', error.message);
    }),
  taskkillNow: (args) =>
    void execFileSync('taskkill', args, { stdio: 'ignore', windowsHide: true }),
  signal: (pid, signal) => void process.kill(pid, signal),
  later: (run, ms) => void setTimeout(run, ms).unref(),
};

/** `child.kill()` would stop only cmd.exe on Windows and leave Claude and its
 *  tools running, so this ends the whole tree: `taskkill /T` on Windows, the
 *  process group elsewhere. */
export function processTreeKiller(context: KillContext = NODE_KILL_CONTEXT): ProcessTreeKiller {
  const isWindows = context.platform === 'win32';
  return {
    stop(pid) {
      if (isWindows) return taskkill(context.taskkill, pid);
      signalGroup(context, pid, 'SIGTERM');
      context.later(() => signalGroup(context, pid, 'SIGKILL'), FORCE_AFTER_MS);
    },
    stopNow(pid) {
      if (isWindows) return taskkill(context.taskkillNow, pid);
      signalGroup(context, pid, 'SIGTERM');
    },
  };
}
