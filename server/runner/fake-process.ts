import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { finished } from 'node:stream/promises';
import type { Launch, RunProcess } from './claude-launcher.ts';
import type { ProcessTreeKiller } from './process-tree.ts';

/** A stand-in for Claude Code: a test writes its output and ends it. Nothing is started. */
export class FakeProcess implements RunProcess {
  readonly pid: number | undefined;
  readonly stdin = new PassThrough();
  readonly stdout = new PassThrough();
  readonly stderr = new PassThrough();
  /** What was written to stdin: the prompt. */
  received = '';
  private readonly events = new EventEmitter();

  constructor(pid: number | undefined) {
    this.pid = pid;
    this.stdin.setEncoding('utf8');
    this.stdin.on('data', (chunk: string) => (this.received += chunk));
  }

  onExit(listener: (code: number | null) => void): void {
    this.events.on('exit', listener);
  }

  onClose(listener: (code: number | null) => void): void {
    this.events.on('close', listener);
  }

  onError(listener: (error: Error) => void): void {
    this.events.on('error', listener);
  }

  /** Writes lines to stdout, as Claude Code would. */
  print(...lines: string[]): void {
    this.stdout.write(lines.map((line) => `${line}\n`).join(''));
  }

  /** Exits with `code`, then closes once its output has been read, as a process does. */
  end(code: number | null): void {
    this.events.emit('exit', code);
    this.stdout.end();
    this.stderr.end();
    void Promise.all([finished(this.stdout), finished(this.stderr)]).then(() =>
      this.events.emit('close', code),
    );
  }

  /** Exits, but something it started keeps its output open. */
  exitLeavingOutputOpen(code: number | null): void {
    this.events.emit('exit', code);
  }

  fail(error: Error): void {
    this.events.emit('error', error);
  }
}

/** A launcher that hands out FakeProcesses, numbered from 100, and keeps them. */
export function fakeLauncher(): { launch: Launch; started: FakeProcess[]; folders: string[] } {
  const started: FakeProcess[] = [];
  const folders: string[] = [];
  const launch: Launch = (folder) => {
    const process = new FakeProcess(100 + started.length);
    started.push(process);
    folders.push(folder);
    return process;
  };
  return { launch, started, folders };
}

/** A killer that records each pid and, unless told not to, ends that process. */
export function fakeKiller(
  started: readonly FakeProcess[],
  { isEffective = true } = {},
): { killer: ProcessTreeKiller; stopped: number[]; stoppedNow: number[] } {
  const stopped: number[] = [];
  const stoppedNow: number[] = [];
  const endProcess = (pid: number): void => {
    if (isEffective) started.find((process) => process.pid === pid)?.end(null);
  };
  return {
    stopped,
    stoppedNow,
    killer: {
      stop: (pid) => {
        stopped.push(pid);
        endProcess(pid);
      },
      stopNow: (pid) => {
        stoppedNow.push(pid);
      },
    },
  };
}
