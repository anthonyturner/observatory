import {
  type LaunchContext,
  NODE_CONTEXT,
  asRunProcess,
  withoutCredentials,
} from '../runner/claude-launcher.ts';
import { type ProcessTreeKiller, processTreeKiller } from '../runner/process-tree.ts';
import { OutputTail } from './output-tail.ts';

/** One command the preparation of a pull request's worktree runs. */
export type ToolCall =
  /** `git` with these arguments, started directly: nothing in them is read by a shell. */
  | { readonly tool: 'git'; readonly args: readonly string[] }
  /** One of the two fixed npm installs, in `cwd`. npm is a batch file on Windows, so it goes through the shell as a line made of these words only. */
  | { readonly tool: 'npm'; readonly cwd: string; readonly command: 'ci' | 'install' };

export interface ToolOptions {
  /** Ends the command when aborted. */
  readonly signal: AbortSignal;
  /** A command still running after this long is ended. */
  readonly limitMs: number;
}

export interface ToolResult {
  /** The exit code; null when it was ended, or could not start. */
  readonly code: number | null;
  /** What it printed to stdout, the end of it. */
  readonly stdout: string;
  /** The last line it printed on either stream, or why it could not start. */
  readonly lastLine: string;
  /** It was ended because it ran past its limit. */
  readonly hasTimedOut: boolean;
}

/** Runs git and npm for a worktree, and ends whatever it started. */
export interface ToolRunner {
  run(call: ToolCall, options: ToolOptions): Promise<ToolResult>;
  /** Ends every command still running, at once: for the API's exit. */
  shutdown(): void;
}

/** What a runner needs from the machine; tests give their own. */
export interface ToolContext extends LaunchContext {
  readonly killer: ProcessTreeKiller;
  /** Runs `run` after `ms`, unless the returned function is called first. */
  readonly later: (run: () => void, ms: number) => () => void;
}

/** A hash or a worktree listing is far shorter; this only bounds a chatty command. */
const STDOUT_KEPT_CHARS = 64 * 1024;

const NODE_TOOL_CONTEXT: ToolContext = {
  ...NODE_CONTEXT,
  killer: processTreeKiller(),
  later: (run, ms) => {
    const timer = setTimeout(run, ms);
    timer.unref();
    return () => clearTimeout(timer);
  },
};

const ENDED: ToolResult = { code: null, stdout: '', lastLine: '', hasTimedOut: false };

/**
 * Starts git and npm without the API's credentials, and without a terminal to
 * ask a question in: git is told never to prompt, and stdin is closed.
 */
export function toolRunner(context: ToolContext = NODE_TOOL_CONTEXT): ToolRunner {
  const live = new Set<number>();
  const spawnFor = (call: ToolCall) => {
    const options = {
      env: { ...withoutCredentials(context.env), GIT_TERMINAL_PROMPT: '0' },
      windowsHide: true,
      // Its own process group elsewhere, so a kill reaches its children too.
      detached: context.platform !== 'win32',
      stdio: ['pipe', 'pipe', 'pipe'] as ['pipe', 'pipe', 'pipe'],
    };
    return call.tool === 'git'
      ? context.spawn('git', call.args, options)
      : context.spawn(`npm ${call.command}`, [], { ...options, cwd: call.cwd, shell: true });
  };

  return {
    run: (call, { signal, limitMs }) =>
      new Promise((resolve) => {
        if (signal.aborted) return resolve(ENDED);
        const child = asRunProcess(spawnFor(call));
        const { pid } = child;
        const tail = new OutputTail();
        let stdout = '';
        let hasTimedOut = false;
        const end = (): void => {
          if (pid !== undefined) context.killer.stop(pid);
        };
        const cancelLimit = context.later(() => {
          hasTimedOut = true;
          end();
        }, limitMs);
        signal.addEventListener('abort', end, { once: true });
        if (pid !== undefined) live.add(pid);
        const finish = (code: number | null, lastLine = tail.lastLine()): void => {
          cancelLimit();
          signal.removeEventListener('abort', end);
          if (pid !== undefined) live.delete(pid);
          resolve({ code, stdout, lastLine, hasTimedOut });
        };
        child.stdout.on('data', (chunk: string | Buffer) => {
          stdout = (stdout + chunk.toString()).slice(-STDOUT_KEPT_CHARS);
          tail.add(chunk);
        });
        child.stderr.on('data', (chunk: string | Buffer) => tail.add(chunk));
        child.stdin.end();
        child.onError((error) => finish(null, error.message));
        child.onClose((code) => finish(code));
      }),
    shutdown() {
      for (const pid of live) context.killer.stopNow(pid);
      live.clear();
    },
  };
}
