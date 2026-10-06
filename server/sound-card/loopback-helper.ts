import { spawn } from 'node:child_process';
import type { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import type { PcmFormat, PcmSource } from './pcm-source.ts';

/** What wasapi-loopback.cs writes: Windows converts to it from any device's own mix. */
export const LOOPBACK_FORMAT: PcmFormat = { sampleRate: 48_000, channels: 2 };

/** The helper's stderr line once Windows has started the capture. */
const STARTED_LINE = 'capturing';
const HELPER_SOURCE = fileURLToPath(new URL('./wasapi-loopback.cs', import.meta.url));

/** The parts of a running helper this file uses; tests give their own. */
export interface HelperProcess {
  readonly stdin: { end(): void };
  readonly stdout: Readable;
  readonly stderr: Readable;
  kill(): void;
  onClose(listener: (code: number | null) => void): void;
  onError(listener: (error: Error) => void): void;
}

export type HelperSpawner = (command: string, args: readonly string[]) => HelperProcess;

const spawnHidden: HelperSpawner = (command, args) => {
  const child = spawn(command, args, { windowsHide: true, stdio: 'pipe' });
  return {
    stdin: child.stdin,
    stdout: child.stdout,
    stderr: child.stderr,
    kill: () => void child.kill(),
    onClose: (listener) => void child.on('close', listener),
    onError: (listener) => void child.on('error', listener),
  };
};

/** PowerShell quotes a literal by doubling its single quotes. */
const quoted = (path: string): string => `'${path.replaceAll("'", "''")}'`;

/**
 * Windows PowerShell 5.1 and the .NET Framework it compiles C# with ship with
 * every Windows 10 and 11, so the capture needs nothing installed.
 */
export const HELPER_ARGS: readonly string[] = [
  '-NoProfile',
  '-NonInteractive',
  '-ExecutionPolicy',
  'Bypass',
  '-Command',
  `Add-Type -Path ${quoted(HELPER_SOURCE)}; exit [ObservatoryLoopback]::Run()`,
];

/**
 * The default speakers' sound, read through Windows loopback (WASAPI) by a
 * small helper process: its stdout is the sound, its stderr says when it
 * started or why it could not.
 */
export function wasapiLoopback(spawnHelper: HelperSpawner = spawnHidden): PcmSource {
  return (events) => {
    const helper = spawnHelper('powershell.exe', HELPER_ARGS);
    let isStopped = false;
    let complaint = '';
    const end = (problem: string | null): void => {
      if (isStopped) return;
      isStopped = true;
      events.ended(problem);
    };
    helper.stdout.on('data', (chunk: Buffer) => events.data(chunk));
    helper.stderr.setEncoding('utf8');
    helper.stderr.on('data', (text: string) => {
      if (text.split(/\r?\n/).includes(STARTED_LINE)) events.started();
      else complaint += text;
    });
    helper.onError((error) => end(error.message));
    helper.onClose((code) =>
      end(code === 0 ? null : complaint.trim() || `the loopback helper exited with ${code}`),
    );
    return () => {
      if (isStopped) return;
      isStopped = true;
      // Closing stdin is the helper's cue to stop; killing it makes sure.
      helper.stdin.end();
      helper.kill();
    };
  };
}
