import { execFile } from 'node:child_process';

/** What one git call printed, and how it exited. */
export interface GitOutput {
  readonly code: number;
  readonly stdout: string;
  readonly stderr: string;
  /** Printed more than the runner keeps, so `stdout` stops short. */
  readonly isCut: boolean;
}

/** Runs `git <args>` in `dir`. A non-zero exit is an answer, not an error:
 *  only a call that could not run or did not finish rejects. */
export type Git = (dir: string, args: readonly string[]) => Promise<GitOutput>;

/** The call ran past its time and was stopped. */
export class GitTimedOut extends Error {}

export interface GitLimits {
  readonly timeoutMs: number;
  readonly maxBytes: number;
}

const DEFAULT_LIMITS: GitLimits = { timeoutMs: 15_000, maxBytes: 32 * 1024 * 1024 };

/* A live agent may be mid-commit in this folder. `--no-optional-locks` keeps
   git from refreshing the index, so a read never takes `index.lock` from it;
   fsmonitor would start a daemon there; no terminal is attached, so a prompt
   must fail rather than wait. Unquoted paths keep a diff's file headers in
   the shape the page splits it by. */
const READ_ONLY_OPTIONS = [
  '--no-optional-locks',
  '-c',
  'core.fsmonitor=false',
  '-c',
  'core.quotePath=false',
];
const GIT_ENV = { ...process.env, GIT_TERMINAL_PROMPT: '0', GIT_OPTIONAL_LOCKS: '0' };
const MAX_BUFFER_EXCEEDED = 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER';

interface ExecFailure {
  readonly code?: unknown;
  readonly killed?: unknown;
}

/** git as `execFile` runs it, never through a shell, so nothing in an
 *  argument is ever read as a command. */
export function readOnlyGit(limits: GitLimits = DEFAULT_LIMITS): Git {
  return (dir, args) =>
    new Promise((done, fail) => {
      execFile(
        'git',
        [...READ_ONLY_OPTIONS, '-C', dir, ...args],
        {
          encoding: 'utf8',
          env: GIT_ENV,
          timeout: limits.timeoutMs,
          maxBuffer: limits.maxBytes,
          windowsHide: true,
        },
        (error, stdout, stderr) => {
          if (!error) return done({ code: 0, stdout, stderr, isCut: false });
          const failure = error as ExecFailure;
          if (failure.code === MAX_BUFFER_EXCEEDED) {
            return done({ code: 0, stdout, stderr, isCut: true });
          }
          if (typeof failure.code === 'number') {
            return done({ code: failure.code, stdout, stderr, isCut: false });
          }
          return fail(
            failure.killed === true ? new GitTimedOut(`git ${args[0]} timed out`) : error,
          );
        },
      );
    });
}
