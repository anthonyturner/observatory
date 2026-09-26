import { type ChildProcess, type SpawnOptions, spawn } from 'node:child_process';
import type { Readable, Writable } from 'node:stream';
import { CLAUDE_ARGS, type ClaudeCommand } from './claude-command.ts';

/** A started Claude Code, as a run watches it. */
export interface RunProcess {
  /** Undefined when it could not be started; `onError` then says why. */
  readonly pid: number | undefined;
  readonly stdin: Writable;
  readonly stdout: Readable;
  readonly stderr: Readable;
  /** The process itself ended; something it started may still hold its output open. */
  onExit(listener: (code: number | null) => void): void;
  /** The process ended and its output closed. */
  onClose(listener: (code: number | null) => void): void;
  onError(listener: (error: Error) => void): void;
}

/** Starts Claude Code in a checkout. */
export type Launch = (folder: string) => RunProcess;

export type Spawner = (
  command: string,
  args: readonly string[],
  options: SpawnOptions,
) => ChildProcess;

/** How a launcher starts processes; tests give their own. */
export interface LaunchContext {
  readonly spawn: Spawner;
  readonly platform: NodeJS.Platform;
  readonly env: NodeJS.ProcessEnv;
}

/** The server's own credentials, which a run has no business holding. */
const WITHHELD_ENV = new Set([
  'OPENROUTER_API_KEY',
  'ELEVENLABS_API_KEY',
  'OBSERVATORY_PUSH_TOKEN',
  'SESSION_SECRET',
]);
const CMD_SPECIAL = /["%^&|<>!\r\n]/;
const CMD_PLAIN = /^[\w.,:=/+-]+$/;

/** A fixed flag as cmd.exe must see it. Only CLAUDE_ARGS come through here, so
 *  a character cmd.exe would act on is a mistake in them. */
export function cmdArg(arg: string): string {
  if (CMD_SPECIAL.test(arg)) throw new Error(`not a safe flag for cmd.exe: ${arg}`);
  return CMD_PLAIN.test(arg) ? arg : `"${arg}"`;
}

const withoutCredentials = (env: NodeJS.ProcessEnv): NodeJS.ProcessEnv =>
  Object.fromEntries(Object.entries(env).filter(([name]) => !WITHHELD_ENV.has(name.toUpperCase())));

/** A batch shim starts only through cmd.exe, as one line of fixed flags. That
 *  is safe only because the prompt never reaches it: it goes on stdin. */
const commandLine = (claude: ClaudeCommand): [string, readonly string[]] =>
  claude.isShim
    ? [`"${claude.file}" ${CLAUDE_ARGS.map(cmdArg).join(' ')}`, []]
    : [claude.file, CLAUDE_ARGS];

function asRunProcess(child: ChildProcess): RunProcess {
  const { stdin, stdout, stderr } = child;
  if (!stdin || !stdout || !stderr) throw new Error('Claude Code started without its pipes');
  return {
    get pid() {
      return child.pid;
    },
    stdin,
    stdout,
    stderr,
    onExit: (listener) => void child.on('exit', listener),
    onClose: (listener) => void child.on('close', listener),
    onError: (listener) => void child.on('error', listener),
  };
}

const NODE_CONTEXT: LaunchContext = { spawn, platform: process.platform, env: process.env };

/** Starts `claude` with CLAUDE_ARGS, or null when there is no `claude` to start. */
export function claudeLauncher(
  claude: ClaudeCommand | null,
  context: LaunchContext = NODE_CONTEXT,
): Launch | null {
  if (!claude) return null;
  const [command, args] = commandLine(claude);
  return (folder) =>
    asRunProcess(
      context.spawn(command, args, {
        cwd: folder,
        env: withoutCredentials(context.env),
        shell: claude.isShim,
        windowsHide: true,
        // Its own process group elsewhere, so a kill reaches its children too.
        detached: context.platform !== 'win32',
        stdio: ['pipe', 'pipe', 'pipe'],
      }),
    );
}
