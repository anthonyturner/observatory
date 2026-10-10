import type { CheckoutRegistry } from '../runner/checkouts.ts';
import type { RunProcess } from '../runner/claude-launcher.ts';
import { readLines } from '../runner/line-reader.ts';
import type { ProcessTreeKiller } from '../runner/process-tree.ts';
import type { DevLaunch } from './dev-launcher.ts';
import { type FreePort, withPort } from './dev-port.ts';
import { NO_CHECKOUT, NO_COMMAND, NO_PORT, exitReason, timeoutReason } from './dev-reasons.ts';
import type {
  DevServerControl,
  DevServerStatus,
  DevTarget,
  StartPhase,
} from './dev-server-types.ts';
import { failed, starting, stopped, targetKey, unavailable } from './dev-target.ts';
import { OutputTail } from './output-tail.ts';
import { plainText } from './preview-url.ts';
import type { RunCommand, RunCommands } from './run-command.ts';
import { SiteAddress } from './site-address.ts';
import type { SiteProbe } from './site-probe.ts';
import type { Workspace, Workspaces } from './workspace.ts';

/** A dev server whose site does not answer within this long is stopped. Builds can be slow, so it is generous. It starts when the server does, so a pull request's fetch and install are not counted against it. */
const START_LIMIT_MS = 120_000;
/** How often a starting server's address is tried. */
const POLL_MS = 500;
/** After a server exits, how long its output streams get to finish, since a child it started can hold them open. */
const OUTPUT_GRACE_MS = 250;
/** How long Stop waits for a killed server to be gone before it removes the files the server held open. */
const GONE_WAIT_MS = 15_000;
/** How many times a port that another server holds is set aside before giving up on finding one. */
const PORT_ATTEMPTS = 10;
/** A line of server output longer than this is not an address line. */
const MAX_LINE_CHARS = 8 * 1024;

/** What a dev-server manager needs from the machine; tests give their own. */
export interface DevServerDependencies {
  readonly checkouts: Pick<CheckoutRegistry, 'find'>;
  readonly commands: RunCommands;
  readonly workspaces: Workspaces;
  readonly launch: DevLaunch;
  readonly killer: ProcessTreeKiller;
  readonly freePort: FreePort;
  readonly probe: SiteProbe;
  /** Runs `run` after `ms`, unless the returned function is called first. */
  readonly later: (run: () => void, ms: number) => () => void;
  readonly startLimitMs?: number;
}

/** One target's server as the manager tracks it. */
interface Entry {
  readonly target: DevTarget;
  readonly workspace: Workspace;
  status: DevServerStatus;
  pid: number | undefined;
  /** The port this server was told to use, held from the moment it is chosen. */
  port: number | undefined;
  /** Where the site probably is; replaced once the command and port are known. */
  address: SiteAddress;
  readonly tail: OutputTail;
  /** Ends the workspace's preparation, and any command it has running. */
  readonly preparing: AbortController;
  /** Settles once nothing of this entry is running: its server has exited, or it never got one. */
  readonly gone: Promise<void>;
  markGone: () => void;
  cancelLimit: () => void;
  cancelPoll: () => void;
  cancelOutputWait: () => void;
}

interface Launchable {
  readonly folder: string;
  readonly run: RunCommand;
  readonly port: number;
}

const isAlive = (entry: Entry): boolean =>
  entry.status.state === 'starting' || entry.status.state === 'running';

function newEntry(target: DevTarget, workspace: Workspace): Entry {
  let markGone = (): void => undefined;
  const gone = new Promise<void>((resolve) => (markGone = resolve));
  return {
    target,
    workspace,
    status: starting(target, workspace.firstPhase),
    pid: undefined,
    port: undefined,
    address: new SiteAddress(null, null),
    tail: new OutputTail(),
    preparing: new AbortController(),
    gone,
    markGone,
    cancelLimit: () => undefined,
    cancelPoll: () => undefined,
    cancelOutputWait: () => undefined,
  };
}

/**
 * The dev servers of this machine's projects, at most one per target. Each
 * target's workspace decides the folder it runs in, from the registry's
 * checkout and never from a folder a request names. The server gets a free
 * port chosen here, and is running once its site answers a request.
 */
export class DevServers implements DevServerControl {
  private readonly entries = new Map<string, Entry>();
  /** Stops still giving a workspace back, which a start of the same target waits for. */
  private readonly removals = new Map<string, Promise<DevServerStatus>>();
  private readonly dependencies: DevServerDependencies;

  constructor(dependencies: DevServerDependencies) {
    this.dependencies = dependencies;
  }

  async start(target: DevTarget): Promise<DevServerStatus> {
    const key = targetKey(target);
    const existing = this.entries.get(key);
    if (existing && existing.status.state !== 'failed') return existing.status;
    // Claimed before the first await, so a second Run in the meantime reuses this one.
    const entry = newEntry(target, this.dependencies.workspaces.of(target));
    this.entries.set(key, entry);
    let hasHandedOver = false;
    try {
      await this.removals.get(key);
      const checkout = await this.dependencies.checkouts.find(target.repo);
      if (this.entries.get(key) !== entry) return stopped(target);
      if (!checkout) {
        this.entries.delete(key);
        return unavailable(target, NO_CHECKOUT);
      }
      hasHandedOver = true;
      const launching = this.launchIn(entry, checkout.folder);
      // A slow workspace, such as a pull request's fetch and install, answers at once and the
      // status tells how far it has got. A quick one answers with how it went.
      if (entry.workspace.isQuick) await launching;
    } catch (error) {
      if (this.entries.get(key) === entry) this.entries.delete(key);
      throw error;
    } finally {
      // launchIn settles it from here on.
      if (!hasHandedOver) entry.markGone();
    }
    return entry.status;
  }

  async status(target: DevTarget): Promise<DevServerStatus> {
    const entry = this.entries.get(targetKey(target));
    if (entry) return entry.status;
    try {
      return (await this.dependencies.checkouts.find(target.repo))
        ? stopped(target)
        : unavailable(target, NO_CHECKOUT);
    } catch (error: unknown) {
      // The projects could not be read, so whether there is a clone is not known: Run stays, and fails with its reason if pressed.
      console.error(`Could not look up ${target.repo}'s checkout:`, error);
      return stopped(target);
    }
  }

  async stop(target: DevTarget): Promise<DevServerStatus> {
    const key = targetKey(target);
    const entry = this.entries.get(key);
    if (entry) this.discard(key, entry);
    const workspace = entry?.workspace ?? this.dependencies.workspaces.of(target);
    if (!workspace.leavesFiles) return stopped(target);
    const removing = this.release(target, workspace, entry);
    this.removals.set(key, removing);
    try {
      return await removing;
    } finally {
      if (this.removals.get(key) === removing) this.removals.delete(key);
    }
  }

  /** Kills every live server at once and leaves the workspaces' files for the next start to reuse: for the API's own exit. */
  shutdown(): void {
    for (const entry of this.entries.values()) {
      this.clearTimers(entry);
      if (isAlive(entry) && entry.pid !== undefined) this.dependencies.killer.stopNow(entry.pid);
    }
    this.entries.clear();
    this.dependencies.workspaces.shutdown();
  }

  /** Forgets the entry and ends everything it has running. */
  private discard(key: string, entry: Entry): void {
    this.entries.delete(key);
    this.clearTimers(entry);
    entry.preparing.abort();
    if (isAlive(entry) && entry.pid !== undefined) this.dependencies.killer.stop(entry.pid);
  }

  /** Waits for the server to be gone, since it holds its files open, and then gives its workspace back. */
  private async release(
    target: DevTarget,
    workspace: Workspace,
    entry: Entry | undefined,
  ): Promise<DevServerStatus> {
    try {
      if (entry) await this.untilGone(entry);
      const checkout = await this.dependencies.checkouts.find(target.repo);
      const problem = checkout ? await workspace.release(checkout.folder) : null;
      return problem ? failed(target, problem) : stopped(target);
    } catch (error: unknown) {
      console.error(`Could not release the workspace of ${target.repo}:`, error);
      return failed(target, `Its files could not be removed: ${(error as Error).message}`);
    }
  }

  private untilGone(entry: Entry): Promise<void> {
    return new Promise((resolve) => {
      const stopWaiting = this.dependencies.later(resolve, GONE_WAIT_MS);
      void entry.gone.then(() => {
        stopWaiting();
        resolve();
      });
    });
  }

  /**
   * Gets the workspace's folder to run in, then launches the server there. Whatever goes
   * wrong is the entry's failure, so this never throws.
   */
  private async launchIn(entry: Entry, clone: string): Promise<void> {
    try {
      const prepared = await entry.workspace.prepare(clone, {
        signal: entry.preparing.signal,
        onPhase: (phase) => this.moveTo(entry, phase),
        isBusy: (target) => this.entries.has(targetKey(target)),
      });
      if (!this.isCurrent(entry)) return;
      if ('why' in prepared) return this.finish(entry, prepared.why);
      const { folder } = prepared;
      const run = this.dependencies.commands.commandFor(entry.target.repo, folder);
      if (!run) return this.finish(entry, NO_COMMAND);
      const port = await this.reservePort(entry);
      if (!this.isCurrent(entry)) return;
      if (port === null) return this.finish(entry, NO_PORT);
      this.launch(entry, { folder, run, port });
    } catch (error: unknown) {
      console.error(`Could not start the dev server of ${entry.target.repo}:`, error);
      this.finish(entry, `The dev server could not be started: ${(error as Error).message}`);
    } finally {
      if (entry.pid === undefined) entry.markGone();
    }
  }

  private moveTo(entry: Entry, phase: StartPhase): void {
    if (this.isStarting(entry)) entry.status = starting(entry.target, phase);
  }

  /** A free port no other live server holds, held for `entry` from the moment it is known. */
  private async reservePort(entry: Entry): Promise<number | null> {
    for (let attempt = 0; attempt < PORT_ATTEMPTS; attempt += 1) {
      const port = await this.dependencies.freePort();
      if (!this.isHeld(port)) {
        entry.port = port;
        return port;
      }
    }
    return null;
  }

  private isHeld(port: number): boolean {
    return [...this.entries.values()].some((each) => isAlive(each) && each.port === port);
  }

  private launch(entry: Entry, { folder, run, port }: Launchable): void {
    this.moveTo(entry, 'starting');
    const command = withPort(run.command, port);
    entry.address = new SiteAddress(run.url, `http://localhost:${port}/`);
    const child: RunProcess = this.dependencies.launch(folder, command, port);
    entry.pid = child.pid;
    entry.cancelLimit = this.dependencies.later(
      () => this.giveUp(entry),
      this.dependencies.startLimitMs ?? START_LIMIT_MS,
    );
    child.onError((error) => {
      entry.markGone();
      this.finish(entry, `Could not start "${command}": ${error.message}`);
    });
    // The last words are in the output that arrives after the exit, so the reason waits for it.
    const endWithLastWords = (code: number | null): void =>
      this.finish(entry, exitReason(code, entry.tail.lastLine()));
    child.onExit((code) => {
      entry.markGone();
      if (!this.isLive(entry)) return;
      entry.cancelOutputWait = this.dependencies.later(
        () => endWithLastWords(code),
        OUTPUT_GRACE_MS,
      );
    });
    child.onClose((code) => endWithLastWords(code));
    this.listen(entry, child);
    this.pollSoon(entry);
  }

  /** Both streams are read to the end, whatever they say, or a full pipe would stall the server. */
  private listen(entry: Entry, child: RunProcess): void {
    const listener = {
      onLine: (line: string) => this.hear(entry, line),
      onOverlong: (head: string) => this.hear(entry, head),
    };
    for (const stream of [child.stdout, child.stderr]) {
      readLines(stream, MAX_LINE_CHARS, listener);
      stream.on('data', (chunk: string | Buffer) => entry.tail.add(chunk));
    }
  }

  private hear(entry: Entry, line: string): void {
    if (this.isStarting(entry)) entry.address.hear(plainText(line));
  }

  private pollSoon(entry: Entry): void {
    entry.cancelPoll = this.dependencies.later(() => this.poll(entry), POLL_MS);
  }

  /** Tries the best address so far; the next poll is scheduled once the answer is in. */
  private poll(entry: Entry): void {
    if (!this.isStarting(entry)) return;
    entry.address.pass();
    const url = entry.address.candidate();
    if (!url) return this.pollSoon(entry);
    void this.dependencies.probe(url).then((answered) => {
      if (!this.isStarting(entry)) return;
      if (answered) this.ready(entry, url);
      else this.pollSoon(entry);
    });
  }

  private isCurrent(entry: Entry): boolean {
    return this.entries.get(targetKey(entry.target)) === entry;
  }

  private isLive(entry: Entry): boolean {
    return this.isCurrent(entry) && isAlive(entry);
  }

  private isStarting(entry: Entry): boolean {
    return this.isCurrent(entry) && entry.status.state === 'starting';
  }

  private clearTimers(entry: Entry): void {
    entry.cancelLimit();
    entry.cancelPoll();
    entry.cancelOutputWait();
  }

  private ready(entry: Entry, url: string): void {
    this.clearTimers(entry);
    entry.status = { ...entry.target, state: 'running', url };
  }

  /** The server ended, or never started, on its own: it stays listed as failed until Run or Stop. */
  private finish(entry: Entry, reason: string): void {
    if (this.isLive(entry)) this.fail(entry, reason);
  }

  private giveUp(entry: Entry): void {
    if (!this.isStarting(entry)) return;
    this.fail(entry, timeoutReason(entry.address.candidate(), entry.tail.lastLine()));
    if (entry.pid !== undefined) this.dependencies.killer.stop(entry.pid);
  }

  private fail(entry: Entry, reason: string): void {
    this.clearTimers(entry);
    entry.status = failed(entry.target, reason);
  }
}
