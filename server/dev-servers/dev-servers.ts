import type { RunProcess } from '../runner/claude-launcher.ts';
import type { CheckoutRegistry } from '../runner/checkouts.ts';
import { readLines } from '../runner/line-reader.ts';
import type { ProcessTreeKiller } from '../runner/process-tree.ts';
import type { DevLaunch } from './dev-launcher.ts';
import type { DevServerControl, DevServerStatus } from './dev-server-types.ts';
import { isLocalLine, localUrlIn, plainText } from './preview-url.ts';
import type { RunCommand, RunCommands } from './run-command.ts';

export const NO_CHECKOUT =
  'There is no local checkout of this project on this machine. Add one to ~/.claude/observatory/clones.json.';
export const NO_COMMAND =
  'This project has no "dev" or "start" script. Add a command for it to ~/.claude/observatory/run.json.';
export const NO_ADDRESS =
  'The server printed no localhost address, so it was stopped. Add a "url" for it to ~/.claude/observatory/run.json.';

/** A dev server that prints no address within this long is stopped. Builds can be slow, so it is generous. */
const START_LIMIT_MS = 120_000;
/** A localhost address not labelled `Local:` waits this long for one that is, since a full-stack
 *  script may print its API's address first. */
const LOCAL_LABEL_GRACE_MS = 1_500;
/** A line of server output longer than this is not an address line. */
const MAX_LINE_CHARS = 8 * 1024;
/** How much of the server's last words go into a failure's reason. */
const LAST_LINE_CHARS = 200;

/** What a dev-server manager needs from the machine; tests give their own. */
export interface DevServerDependencies {
  readonly checkouts: CheckoutRegistry;
  readonly commands: RunCommands;
  readonly launch: DevLaunch;
  readonly killer: ProcessTreeKiller;
  /** Runs `run` after `ms`, unless the returned function is called first. */
  readonly later: (run: () => void, ms: number) => () => void;
  readonly startLimitMs?: number;
}

/** One project's server as the manager tracks it. */
interface Entry {
  readonly repo: string;
  status: DevServerStatus;
  pid: number | undefined;
  /** Ends the start limit and any wait for a `Local:` address. */
  cancelTimers: () => void;
  cancelGrace: () => void;
  /** The first unlabelled localhost address, held while a `Local:` one is awaited. */
  fallbackUrl: string | null;
  /** The server's latest non-blank output, kept to say how it ended. */
  lastLine: string;
}

type Plan = { readonly folder: string; readonly run: RunCommand } | { readonly why: string };

const keyOf = (repo: string): string => repo.toLowerCase();
const stopped = (repo: string): DevServerStatus => ({ repo, state: 'stopped' });
const isAlive = (entry: Entry): boolean =>
  entry.status.state === 'starting' || entry.status.state === 'running';

function exitReason(code: number | null, lastLine: string): string {
  const how = code === null ? 'was ended' : `exited with code ${code}`;
  return `The dev server ${how}.${lastLine ? ` Its last output: ${lastLine}` : ''}`;
}

/**
 * The dev servers of this machine's projects, at most one each. A project is
 * run in the checkout the registry knows, never in a folder a request names;
 * its address is read from what the server prints.
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
      cancelTimers: () => undefined,
      cancelGrace: () => undefined,
      fallbackUrl: null,
      lastLine: '',
    };
    this.entries.set(key, entry);
    try {
      const plan = await this.plan(repo);
      if (this.entries.get(key) !== entry) return stopped(repo);
      if ('why' in plan) this.fail(entry, plan.why);
      else this.launch(entry, plan.folder, plan.run);
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
    return run ? { folder: checkout.folder, run } : { why: NO_COMMAND };
  }

  private launch(entry: Entry, folder: string, run: RunCommand): void {
    const child: RunProcess = this.dependencies.launch(folder, run.command);
    entry.pid = child.pid;
    entry.cancelTimers = this.dependencies.later(
      () => this.giveUp(entry),
      this.dependencies.startLimitMs ?? START_LIMIT_MS,
    );
    child.onError((error) => this.end(entry, `Could not start "${run.command}": ${error.message}`));
    child.onExit((code) => this.end(entry, exitReason(code, entry.lastLine)));
    // Both streams are read to the end, whatever they say, or a full pipe would stall the server.
    const listener = {
      onLine: (line: string) => this.hear(entry, line),
      onOverlong: (head: string) => this.hear(entry, head),
    };
    readLines(child.stdout, MAX_LINE_CHARS, listener);
    readLines(child.stderr, MAX_LINE_CHARS, listener);
    if (run.url) this.ready(entry, run.url);
  }

  private hear(entry: Entry, line: string): void {
    const text = plainText(line).trim();
    if (text) entry.lastLine = text.slice(0, LAST_LINE_CHARS);
    if (entry.status.state !== 'starting') return;
    const printed = localUrlIn(text);
    if (!printed) return;
    if (isLocalLine(text)) this.ready(entry, printed);
    else this.holdAsFallback(entry, printed);
  }

  private holdAsFallback(entry: Entry, url: string): void {
    if (entry.fallbackUrl !== null) return;
    entry.fallbackUrl = url;
    entry.cancelGrace = this.dependencies.later(() => this.ready(entry, url), LOCAL_LABEL_GRACE_MS);
  }

  private clearTimers(entry: Entry): void {
    entry.cancelTimers();
    entry.cancelGrace();
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
    if (entry.status.state !== 'starting') return;
    this.fail(entry, NO_ADDRESS);
    if (entry.pid !== undefined) this.dependencies.killer.stop(entry.pid);
  }

  private fail(entry: Entry, reason: string): void {
    this.clearTimers(entry);
    entry.status = { repo: entry.repo, state: 'failed', reason };
  }
}
