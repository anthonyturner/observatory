import type { RunProcess } from '../runner/claude-launcher.ts';
import type { CheckoutRegistry } from '../runner/checkouts.ts';
import { readLines } from '../runner/line-reader.ts';
import type { ProcessTreeKiller } from '../runner/process-tree.ts';
import type { DevLaunch } from './dev-launcher.ts';
import { type FreePort, withPort } from './dev-port.ts';
import type { DevServerControl, DevServerStatus } from './dev-server-types.ts';
import { OutputTail } from './output-tail.ts';
import { plainText } from './preview-url.ts';
import type { RunCommand, RunCommands } from './run-command.ts';
import { SiteAddress } from './site-address.ts';
import type { SiteProbe } from './site-probe.ts';

export const NO_CHECKOUT =
  'There is no local checkout of this project on this machine. Add one to ~/.claude/observatory/clones.json.';
export const NO_COMMAND =
  'This project has no "dev" or "start" script. Add a command for it to ~/.claude/observatory/run.json.';
export const NO_SITE =
  'The server printed nothing and nothing answered at an address we could find, so it was stopped. Add a "url" for it to ~/.claude/observatory/run.json.';

/** A dev server whose site does not answer within this long is stopped. Builds can be slow, so it is generous. */
const START_LIMIT_MS = 120_000;
/** How often a starting server's address is tried. */
const POLL_MS = 500;
/** A line of server output longer than this is not an address line. */
const MAX_LINE_CHARS = 8 * 1024;

/** What a dev-server manager needs from the machine; tests give their own. */
export interface DevServerDependencies {
  readonly checkouts: CheckoutRegistry;
  readonly commands: RunCommands;
  readonly launch: DevLaunch;
  readonly killer: ProcessTreeKiller;
  readonly freePort: FreePort;
  readonly probe: SiteProbe;
  /** Runs `run` after `ms`, unless the returned function is called first. */
  readonly later: (run: () => void, ms: number) => () => void;
  readonly startLimitMs?: number;
}

/** One project's server as the manager tracks it. */
interface Entry {
  readonly repo: string;
  status: DevServerStatus;
  pid: number | undefined;
  /** Where the site probably is; replaced once the command and port are known. */
  address: SiteAddress;
  readonly tail: OutputTail;
  cancelLimit: () => void;
  cancelPoll: () => void;
}

interface Launchable {
  readonly folder: string;
  readonly run: RunCommand;
  readonly port: number;
}

type Plan = Launchable | { readonly why: string };

const keyOf = (repo: string): string => repo.toLowerCase();
const stopped = (repo: string): DevServerStatus => ({ repo, state: 'stopped' });
const isAlive = (entry: Entry): boolean =>
  entry.status.state === 'starting' || entry.status.state === 'running';
const quoted = (line: string): string => `"${line}"`;

function exitReason(code: number | null, lastLine: string): string {
  const how = code === null ? 'was ended' : `exited with code ${code}`;
  return `The dev server ${how}.${lastLine ? ` Its last output: ${quoted(lastLine)}` : ''}`;
}

const timeoutReason = (lastLine: string): string =>
  lastLine ? `The server stopped at: ${quoted(lastLine)}` : NO_SITE;

/**
 * The dev servers of this machine's projects, at most one each. A project is
 * run in the checkout the registry knows, never in a folder a request names, on
 * a free port chosen here. It is running once its site answers a request.
 */
export class DevServers implements DevServerControl {
  private readonly entries = new Map<string, Entry>();
  private readonly dependencies: DevServerDependencies;

  constructor(dependencies: DevServerDependencies) {
    this.dependencies = dependencies;
  }

  async start(repo: string): Promise<DevServerStatus> {
    const key = keyOf(repo);
    const existing = this.entries.get(key);
    if (existing && existing.status.state !== 'failed') return existing.status;
    // Claimed before the first await, so a second Run in the meantime reuses this one.
    const entry: Entry = {
      repo,
      status: { repo, state: 'starting' },
      pid: undefined,
      address: new SiteAddress(null, null),
      tail: new OutputTail(),
      cancelLimit: () => undefined,
      cancelPoll: () => undefined,
    };
    this.entries.set(key, entry);
    try {
      const plan = await this.plan(repo);
      if (this.entries.get(key) !== entry) return stopped(repo);
      if ('why' in plan) this.fail(entry, plan.why);
      else this.launch(entry, plan);
    } catch (error) {
      if (this.entries.get(key) === entry) this.entries.delete(key);
      throw error;
    }
    return entry.status;
  }

  status(repo: string): DevServerStatus {
    return this.entries.get(keyOf(repo))?.status ?? stopped(repo);
  }

  stop(repo: string): DevServerStatus {
    const key = keyOf(repo);
    const entry = this.entries.get(key);
    if (!entry) return stopped(repo);
    this.entries.delete(key);
    this.clearTimers(entry);
    if (isAlive(entry) && entry.pid !== undefined) this.dependencies.killer.stop(entry.pid);
    return stopped(repo);
  }

  /** Kills every live server at once: for the API's own exit. */
  shutdown(): void {
    for (const entry of this.entries.values()) {
      this.clearTimers(entry);
      if (isAlive(entry) && entry.pid !== undefined) this.dependencies.killer.stopNow(entry.pid);
    }
    this.entries.clear();
  }

  private async plan(repo: string): Promise<Plan> {
    const wanted = keyOf(repo);
    const checkouts = await this.dependencies.checkouts.list();
    const checkout = checkouts.find((each) => keyOf(each.repo) === wanted);
    if (!checkout) return { why: NO_CHECKOUT };
    const run = this.dependencies.commands.commandFor(repo, checkout.folder);
    if (!run) return { why: NO_COMMAND };
    return { folder: checkout.folder, run, port: await this.dependencies.freePort() };
  }

  private launch(entry: Entry, { folder, run, port }: Launchable): void {
    const command = withPort(run.command, port);
    entry.address = new SiteAddress(run.url, `http://localhost:${port}/`);
    const child: RunProcess = this.dependencies.launch(folder, command, port);
    entry.pid = child.pid;
    entry.cancelLimit = this.dependencies.later(
      () => this.giveUp(entry),
      this.dependencies.startLimitMs ?? START_LIMIT_MS,
    );
    child.onError((error) => this.end(entry, `Could not start "${command}": ${error.message}`));
    child.onExit((code) => this.end(entry, exitReason(code, entry.tail.lastLine())));
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

  private isStarting(entry: Entry): boolean {
    return this.entries.get(keyOf(entry.repo)) === entry && entry.status.state === 'starting';
  }

  private clearTimers(entry: Entry): void {
    entry.cancelLimit();
    entry.cancelPoll();
  }

  private ready(entry: Entry, url: string): void {
    this.clearTimers(entry);
    entry.status = { repo: entry.repo, state: 'running', url };
  }

  /** The server ended, or never started, on its own: it stays listed as failed until Run or Stop. */
  private end(entry: Entry, reason: string): void {
    if (this.entries.get(keyOf(entry.repo)) !== entry || !isAlive(entry)) return;
    this.fail(entry, reason);
  }

  private giveUp(entry: Entry): void {
    if (!this.isStarting(entry)) return;
    this.fail(entry, timeoutReason(entry.tail.lastLine()));
    if (entry.pid !== undefined) this.dependencies.killer.stop(entry.pid);
  }

  private fail(entry: Entry, reason: string): void {
    this.clearTimers(entry);
    entry.status = { repo: entry.repo, state: 'failed', reason };
  }
}
