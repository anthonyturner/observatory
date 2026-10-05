import { execFile } from 'node:child_process';

/** Who a running process is, as the system says. */
export interface ProcessIdentity {
  /** Its start time in .NET ticks, as speak.ps1 records it: kept as digits,
   *  since ticks are past the largest safe integer. */
  readonly startTicks: string;
  readonly commandLine: string;
}

/** The system calls a check makes; tests give their own. */
export interface ProcessProbe {
  /** Cheap: whether any process has this id now. */
  isAlive(pid: number): boolean;
  /** Costly, about half a second: who has this id, or null when nobody does. Never rejects. */
  identify(pid: number): Promise<ProcessIdentity | null>;
}

/** Whether a stamp (`<pid>|<startTicks>[|<kind>]`) names a live speak.ps1:
 *  its id alive, with the recorded start time, running that script. */
export type SpeakProcessCheck = (stamp: string) => Promise<boolean>;

const STAMP = /^(\d+)\|(\d+)(?:\|\w+)?$/;
const SPEAK_SCRIPT = /speak\.ps1/i;
/** A process id the system has since given to another process would pass
 *  as Agent Speak's for as long as its stale stamp stays; asking again this
 *  often bounds that, and still never asks on each poll. */
const REPROBE_AFTER_MS = 30_000;
/** The player's and the drainer's stamps, and the ones just before them. */
const REMEMBERED_STAMPS = 4;
const IDENTIFY_TIMEOUT_MS = 10_000;

/** The identity in the probe script's output: the start ticks, then the command line. */
export function identityFrom(output: string): ProcessIdentity | null {
  const [ticks = '', ...rest] = output.split(/\r?\n/);
  const startTicks = ticks.trim();
  if (!/^\d+$/.test(startTicks)) return null;
  return { startTicks, commandLine: rest.join(' ').trim() };
}

const identifyScript = (pid: number): string =>
  [
    `$p = Get-Process -Id ${pid} -ErrorAction Stop`,
    `$c = (Get-CimInstance Win32_Process -Filter "ProcessId=${pid}").CommandLine`,
    '$p.StartTime.Ticks',
    '$c',
  ].join('; ');

const isPermissionError = (error: unknown): boolean =>
  error instanceof Error && 'code' in error && error.code === 'EPERM';

/** Agent Speak runs on Windows only; anywhere else nothing is ever identified. */
export const WINDOWS_PROBE: ProcessProbe = {
  isAlive(pid) {
    try {
      process.kill(pid, 0);
      return true;
    } catch (error) {
      return isPermissionError(error);
    }
  },
  identify: (pid) =>
    new Promise((resolve) => {
      execFile(
        'powershell.exe',
        ['-NoProfile', '-NonInteractive', '-Command', identifyScript(pid)],
        { windowsHide: true, timeout: IDENTIFY_TIMEOUT_MS },
        (error, stdout) => resolve(error ? null : identityFrom(stdout)),
      );
    }),
};

/** A check that asks the costly question once per stamp, not once per poll. */
export function speakProcessCheck(
  probe: ProcessProbe = WINDOWS_PROBE,
  clock: () => number = Date.now,
): SpeakProcessCheck {
  const known = new Map<
    string,
    { readonly at: number; readonly identity: Promise<ProcessIdentity | null> }
  >();

  const identityOf = (stamp: string, pid: number): Promise<ProcessIdentity | null> => {
    const entry = known.get(stamp);
    if (entry && clock() - entry.at < REPROBE_AFTER_MS) return entry.identity;
    const identity = probe.identify(pid);
    known.delete(stamp);
    known.set(stamp, { at: clock(), identity });
    const oldest = known.keys().next().value;
    if (known.size > REMEMBERED_STAMPS && oldest !== undefined) known.delete(oldest);
    return identity;
  };

  return async (stamp) => {
    const match = STAMP.exec(stamp.trim());
    const pid = Number(match?.[1]);
    if (!match || !(pid > 0) || !probe.isAlive(pid)) return false;
    const identity = await identityOf(match[0], pid);
    return identity?.startTicks === match[2] && SPEAK_SCRIPT.test(identity.commandLine);
  };
}
