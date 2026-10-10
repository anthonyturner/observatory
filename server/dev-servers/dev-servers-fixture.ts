import assert from 'node:assert/strict';
import type { Checkout } from '../runner/checkouts.ts';
import { FakeProcess, fakeKiller } from '../runner/fake-process.ts';
import type { DevLaunch } from './dev-launcher.ts';
import { DevServers } from './dev-servers.ts';
import type { Prepared, PrepareRequest } from './pull-worktrees.ts';
import type { RunCommand } from './run-command.ts';

export const APP: Checkout = { name: 'app', repo: 'me/app', folder: 'E:/repos/app' };
export const SITE: Checkout = { name: 'site', repo: 'me/site', folder: 'E:/repos/site' };
export const DEV: RunCommand = { command: 'npm run dev', url: null };
export const PORT = 54321;
export const POLL_MS = 500;
export const OUTPUT_GRACE_MS = 250;
export const START_LIMIT_MS = 120_000;

export interface Setting {
  readonly checkouts?: readonly Checkout[];
  readonly command?: RunCommand | null;
  readonly listing?: Promise<void>;
  readonly ports?: readonly number[];
  /** The registry cannot read the projects. */
  readonly lookupFails?: boolean;
  /** How the worktree of a pull request is made; by default at once, in the clone's own folder for it. */
  readonly prepare?: (request: PrepareRequest) => Promise<Prepared>;
  /** Why removing a pull request's worktree fails; by default it does not. */
  readonly removalFails?: string;
  /** Removing a pull request's worktree takes until this settles. */
  readonly removing?: Promise<void>;
  /** Whether stopping a server ends its process; by default it does. */
  readonly isKillEffective?: boolean;
}

export const worktreeOf = (clone: string, pull: number): string =>
  `${clone}/.claude/worktrees/pr-${pull}`;

export function setUp(setting: Setting = {}) {
  const { checkouts = [APP], command = DEV, listing = Promise.resolve() } = setting;
  const ports = [...(setting.ports ?? [PORT])];
  let spare = PORT + 1;
  const processes: FakeProcess[] = [];
  const launches: { folder: string; command: string; port: number }[] = [];
  const asked: { repo: string; folder: string }[] = [];
  const probed: string[] = [];
  /** The addresses that answer; any other is refused. */
  const answering = new Set<string>();
  const timers: { run: () => void; ms: number; cancelled: boolean }[] = [];
  const launch: DevLaunch = (folder, line, port) => {
    const process = new FakeProcess(300 + processes.length);
    processes.push(process);
    launches.push({ folder, command: line, port });
    return process;
  };
  const prepares: PrepareRequest[] = [];
  const removals: { clone: string; pull: number }[] = [];
  const shutdowns: string[] = [];
  const worktrees = {
    prepare: async (request: PrepareRequest): Promise<Prepared> => {
      prepares.push(request);
      return setting.prepare
        ? setting.prepare(request)
        : { folder: worktreeOf(request.clone, request.pull) };
    },
    remove: async (clone: string, pull: number): Promise<string | null> => {
      await setting.removing;
      removals.push({ clone, pull });
      return setting.removalFails ?? null;
    },
    shutdown: () => void shutdowns.push('tools'),
  };
  const kills = fakeKiller(processes, { isEffective: setting.isKillEffective ?? true });
  const servers = new DevServers({
    checkouts: {
      find: async (repo) => {
        await listing;
        if (setting.lookupFails) throw new Error('GitHub could not be read');
        return checkouts.find((each) => each.repo === repo.toLowerCase()) ?? null;
      },
    },
    commands: {
      commandFor: (repo, folder) => {
        asked.push({ repo, folder });
        return command;
      },
    },
    worktrees,
    launch,
    killer: kills.killer,
    freePort: async () => ports.shift() ?? spare++,
    probe: async (url) => {
      probed.push(url);
      return answering.has(url);
    },
    later: (run, ms) => {
      const timer = { run, ms, cancelled: false };
      timers.push(timer);
      return () => void (timer.cancelled = true);
    },
  });
  /** Runs the next poll that is waiting, and lets its probe finish. */
  const poll = async (): Promise<void> => {
    const waiting = timers.findLast((timer) => timer.ms === POLL_MS && !timer.cancelled);
    assert.ok(waiting, 'a poll is waiting');
    waiting.cancelled = true;
    waiting.run();
    await settle();
  };
  const pollTimes = async (count: number): Promise<void> => {
    for (let each = 0; each < count; each += 1) await poll();
  };
  const limit = () => timers.find((timer) => timer.ms === START_LIMIT_MS);
  return {
    servers,
    processes,
    launches,
    asked,
    probed,
    answering,
    timers,
    poll,
    pollTimes,
    limit,
    prepares,
    removals,
    shutdowns,
    ...kills,
  };
}

/** Lets the streams a test wrote to deliver their data, and a probe to answer. */
export const settle = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));
