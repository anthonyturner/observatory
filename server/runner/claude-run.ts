import { randomBytes } from 'node:crypto';
import type { Launch, RunProcess } from './claude-launcher.ts';
import type { ProcessTreeKiller } from './process-tree.ts';
import type { Proposal } from './proposals.ts';
import type { RunLimits } from './run-limits.ts';
import { RunLog } from './run-log.ts';
import { type RunResult, recordOutput } from './run-output.ts';
import { RunTimers } from './run-timers.ts';

/** Why a run was stopped before it finished on its own. */
export type StopReason = 'cancelled' | 'time-limit' | 'shutdown';

export type RunState = 'starting' | 'running' | 'stopping' | 'done' | 'failed' | StopReason;

const ENDED_STATES: ReadonlySet<RunState> = new Set([
  'done',
  'failed',
  'cancelled',
  'time-limit',
  'shutdown',
]);

/** One run as the list and the start and cancel answers show it. */
export interface RunSummary {
  readonly id: string;
  readonly prompt: string;
  readonly folder: string;
  readonly name: string;
  readonly state: RunState;
  readonly startedAt: number;
  readonly endedAt: number | null;
  readonly limitMs: number;
  /** Claude Code's exit code; null until it exits, or when it never did. */
  readonly code: number | null;
  /** Why it failed, or what could not be confirmed. */
  readonly why: string | null;
  readonly result: RunResult | null;
  /** How many events its log has written: where a follower starts. */
  readonly events: number;
}

/** What a run needs from the runner that starts it. */
export interface RunContext {
  readonly launch: Launch;
  readonly killer: ProcessTreeKiller;
  readonly clock: () => number;
  readonly limits: RunLimits;
  readonly onEnd: (run: ClaudeRun) => void;
}

const ID_BYTES = 9;
const COULD_NOT_CONFIRM =
  'Observatory could not confirm that Claude Code stopped. Check Task Manager for claude.exe.';

const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/** One `claude -p` in one checkout, from start to its end, however it ends. */
export class ClaudeRun {
  readonly id = randomBytes(ID_BYTES).toString('base64url');
  readonly log: RunLog;
  private readonly startedAt: number;
  private readonly timers = new RunTimers();
  private state: RunState = 'starting';
  private endedAt: number | null = null;
  private code: number | null = null;
  private why: string | null = null;
  private result: RunResult | null = null;
  private ending: StopReason | null = null;
  private pid: number | undefined;

  private readonly context: RunContext;
  private readonly proposal: Proposal;

  constructor(context: RunContext, proposal: Proposal) {
    this.context = context;
    this.proposal = proposal;
    this.startedAt = context.clock();
    this.log = new RunLog(context.limits.keepBytes, context.clock);
  }

  get isEnded(): boolean {
    return ENDED_STATES.has(this.state);
  }

  /** Starts Claude Code with the prompt on stdin, and the time limit with it. */
  begin(): void {
    const { folder } = this.proposal;
    this.log.append('state', { state: 'starting', folder, limitMs: this.context.limits.runMs });
    let process: RunProcess;
    try {
      process = this.context.launch(folder);
    } catch (error) {
      return this.failToStart(error);
    }
    this.watch(process);
    process.stdin.end(this.proposal.prompt);
    this.timers.after(this.context.limits.runMs, () => this.stop('time-limit'));
  }

  /** Kills the run and everything it started; it ends once they have gone. */
  stop(reason: StopReason): void {
    if (this.isEnded || this.ending) return;
    this.ending = reason;
    this.changeState('stopping', { stopping: reason });
    // A kill that fails would leave the run stopping for ever, and with one run
    // at a time nothing else could start: try once more, then end it anyway
    // and say what could not be confirmed.
    this.timers.after(this.context.limits.stopMs, () => {
      this.kill();
      this.timers.after(this.context.limits.stopMs, () => this.giveUp());
    });
    this.kill();
  }

  /** Kills the run before returning: for the server's own exit. */
  stopNow(): void {
    this.ending ??= 'shutdown';
    if (this.pid !== undefined) this.context.killer.stopNow(this.pid);
  }

  summary(): RunSummary {
    return {
      id: this.id,
      prompt: this.proposal.prompt,
      folder: this.proposal.folder,
      name: this.proposal.name,
      state: this.state,
      startedAt: this.startedAt,
      endedAt: this.endedAt,
      limitMs: this.context.limits.runMs,
      code: this.code,
      why: this.why,
      result: this.result,
      events: this.log.count,
    };
  }

  private watch(process: RunProcess): void {
    this.pid = process.pid;
    recordOutput(process, this.log, this.context.limits.lineBytes, {
      heard: () => this.markRunning(),
      finished: (result) => {
        this.result = result;
      },
    });
    process.onError((error) => this.failToStart(error));
    process.onExit((code) => this.closeSoonAfterExit(process, code));
    process.onClose((code) => this.finish(code));
    // Writing the prompt to a process that died at once fails; onError says why.
    process.stdin.on('error', () => undefined);
  }

  /** Normally the output closes a moment after the process exits; if something
   *  it started still holds it open, the run ends anyway. */
  private closeSoonAfterExit(process: RunProcess, code: number | null): void {
    this.timers.after(this.context.limits.closeMs, () => {
      process.stdout.destroy();
      process.stderr.destroy();
      this.finish(code);
    });
  }

  private markRunning(): void {
    if (this.state === 'starting') this.changeState('running');
  }

  private failToStart(error: unknown): void {
    this.why = `Claude Code could not start: ${messageOf(error)}`;
    this.finish(null);
  }

  private giveUp(): void {
    this.why = COULD_NOT_CONFIRM;
    this.finish(null);
  }

  private kill(): void {
    if (this.pid !== undefined) this.context.killer.stop(this.pid);
  }

  private finish(code: number | null): void {
    if (this.isEnded) return;
    this.timers.clearAll();
    const state = this.ending ?? (code === 0 ? 'done' : 'failed');
    this.why ??= state === 'failed' ? `Claude Code exited with code ${code}` : null;
    this.code = code;
    this.endedAt = this.context.clock();
    this.changeState(state, {
      code,
      endedAt: this.endedAt,
      ...(this.why ? { why: this.why } : {}),
    });
    this.log.close();
    this.context.onEnd(this);
  }

  private changeState(state: RunState, details: Readonly<Record<string, unknown>> = {}): void {
    this.state = state;
    this.log.append('state', { state, ...details });
  }
}
