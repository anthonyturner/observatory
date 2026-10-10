import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Checkout } from '../runner/checkouts.ts';
import { FakeProcess, fakeKiller } from '../runner/fake-process.ts';
import type { DevLaunch } from './dev-launcher.ts';
import { DevServers, NO_CHECKOUT, NO_COMMAND, NO_PORT, NO_SITE } from './dev-servers.ts';
import type { RunCommand } from './run-command.ts';

const APP: Checkout = { name: 'app', repo: 'me/app', folder: 'E:/repos/app' };
const SITE: Checkout = { name: 'site', repo: 'me/site', folder: 'E:/repos/site' };
const DEV: RunCommand = { command: 'npm run dev', url: null };
const PORT = 54321;
const POLL_MS = 500;
const OUTPUT_GRACE_MS = 250;
const START_LIMIT_MS = 120_000;

interface Setting {
  readonly checkouts?: readonly Checkout[];
  readonly command?: RunCommand | null;
  readonly listing?: Promise<void>;
  readonly ports?: readonly number[];
  /** The registry cannot read the projects. */
  readonly lookupFails?: boolean;
}

function setUp(setting: Setting = {}) {
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
  const kills = fakeKiller(processes);
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
    ...kills,
  };
}

/** Lets the streams a test wrote to deliver their data, and a probe to answer. */
const settle = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));

const running = (url: string) => ({ repo: 'me/app', state: 'running', url });
const stoppedApp = { repo: 'me/app', state: 'stopped' };
const LOCAL = `http://localhost:${PORT}/`;

describe('DevServers', () => {
  it('runs the project’s command in its checkout on a free port and reports starting', async () => {
    const { servers, launches, asked } = setUp();

    const status = await servers.start('me/app');

    assert.deepEqual(status, { repo: 'me/app', state: 'starting' });
    assert.deepEqual(launches, [{ folder: 'E:/repos/app', command: 'npm run dev', port: PORT }]);
    assert.deepEqual(asked, [{ repo: 'me/app', folder: 'E:/repos/app' }]);
    assert.deepEqual(await servers.status('me/app'), status);
  });

  it('gives each server its own free port', async () => {
    const { servers, launches } = setUp({ checkouts: [APP, SITE], ports: [4001, 4002] });

    await servers.start('me/app');
    await servers.start('me/site');

    assert.deepEqual(
      launches.map((each) => each.port),
      [4001, 4002],
    );
  });

  it('puts the chosen port where the command has its placeholder', async () => {
    const { servers, launches } = setUp({
      command: { command: 'npm start -- --port {port}', url: null },
    });

    await servers.start('me/app');

    assert.equal(launches[0]?.command, `npm start -- --port ${PORT}`);
  });

  it('is running only once the printed Local: address answers a request, colour codes and all', async () => {
    const { servers, processes, answering, probed, poll } = setUp();
    await servers.start('me/app');
    processes[0]?.print(
      '> app@0.0.0 dev',
      '  \u001B[32m➜\u001B[39m  Local:   \u001B[36mhttp://localhost:\u001B[1m5173\u001B[22m/\u001B[39m',
    );
    processes[0]?.print('  Network: http://localhost:9999/');
    await settle();

    await poll();
    assert.deepEqual(probed, ['http://localhost:5173/']);
    assert.equal((await servers.status('me/app')).state, 'starting', 'nothing answers yet');

    answering.add('http://localhost:5173/');
    await poll();

    assert.deepEqual(await servers.status('me/app'), running('http://localhost:5173/'));
  });

  it('stops polling once the site answers', async () => {
    const { servers, processes, answering, timers, poll } = setUp();
    await servers.start('me/app');
    processes[0]?.print('Local: http://localhost:5173/');
    await settle();
    answering.add('http://localhost:5173/');

    await poll();

    assert.equal((await servers.status('me/app')).state, 'running');
    assert.ok(timers.every((timer) => timer.cancelled));
  });

  it('prefers the address labelled Local: over an earlier one, as a full-stack script prints its API first', async () => {
    const { servers, processes, answering, probed, poll } = setUp();
    await servers.start('me/app');
    answering.add('http://localhost:3001/');
    answering.add('http://localhost:5173/');

    processes[0]?.print('api listening on http://localhost:3001/');
    await settle();
    await poll();
    processes[0]?.print('  Local:   http://localhost:5173/');
    await settle();
    await poll();

    assert.deepEqual(probed, ['http://localhost:5173/']);
    assert.deepEqual(await servers.status('me/app'), running('http://localhost:5173/'));
  });

  it('falls back to the first printed address when no line is labelled Local:, after a short wait', async () => {
    const { servers, processes, answering, probed, pollTimes } = setUp();
    await servers.start('me/app');
    answering.add('http://localhost:3001/');
    processes[0]?.print('listening on http://localhost:3001/', 'also http://localhost:3002/');
    await settle();

    await pollTimes(2);
    assert.deepEqual(probed, []);
    await pollTimes(1);

    assert.deepEqual(await servers.status('me/app'), running('http://localhost:3001/'));
  });

  it('falls back to the assigned port when the server prints no address but listens on it', async () => {
    const { servers, answering, probed, pollTimes } = setUp();
    await servers.start('me/app');
    answering.add(LOCAL);

    await pollTimes(2);
    assert.equal((await servers.status('me/app')).state, 'starting');
    await pollTimes(1);

    assert.deepEqual(probed, [LOCAL]);
    assert.deepEqual(await servers.status('me/app'), running(LOCAL));
  });

  it('stays starting, however long, while the assigned port does not answer', async () => {
    const { servers, probed, pollTimes } = setUp();
    await servers.start('me/app');

    await pollTimes(10);

    assert.equal((await servers.status('me/app')).state, 'starting');
    assert.equal(probed.length, 8, 'one try for each poll after the wait');
  });

  it('uses the owner’s command and address, and is running when that address answers', async () => {
    const { servers, launches, answering, probed, poll } = setUp({
      command: { command: 'make serve', url: 'https://app.test:8443/' },
    });

    const status = await servers.start('me/app');
    assert.equal(status.state, 'starting');
    await poll();
    assert.equal((await servers.status('me/app')).state, 'starting');
    answering.add('https://app.test:8443/');
    await poll();

    assert.deepEqual(launches, [{ folder: 'E:/repos/app', command: 'make serve', port: PORT }]);
    assert.deepEqual(probed, ['https://app.test:8443/', 'https://app.test:8443/']);
    assert.deepEqual(await servers.status('me/app'), running('https://app.test:8443/'));
  });

  it('reads the address from stderr too, and from a line that arrives in pieces', async () => {
    const { servers, processes, answering, poll } = setUp();
    await servers.start('me/app');
    answering.add('http://localhost:4200/');

    processes[0]?.stderr.write('Local: http://local');
    processes[0]?.stderr.write('host:4200/\n');
    await settle();
    await poll();

    assert.deepEqual(await servers.status('me/app'), running('http://localhost:4200/'));
  });

  it('keeps reading output after the address, so a full pipe cannot stall the server', async () => {
    const { servers, processes, answering, poll } = setUp();
    await servers.start('me/app');
    processes[0]?.print('Local: http://localhost:5173/');
    answering.add('http://localhost:5173/');
    await settle();
    await poll();

    processes[0]?.print('hot update', 'hot update');
    await settle();

    assert.equal(processes[0]?.stdout.readableLength, 0);
  });

  it('reuses the server that is running, however many times Run is asked', async () => {
    const { servers, processes, answering, launches, poll } = setUp();

    const [first, second] = await Promise.all([servers.start('me/app'), servers.start('Me/App')]);
    processes[0]?.print('Local: http://localhost:5173/');
    answering.add('http://localhost:5173/');
    await settle();
    await poll();
    const third = await servers.start('me/app');

    assert.equal(first?.state, 'starting');
    assert.equal(second?.state, 'starting');
    assert.deepEqual(third, running('http://localhost:5173/'));
    assert.equal(launches.length, 1);
  });

  it('finds the checkout whatever the case of the repository', async () => {
    const { servers, launches } = setUp();

    await servers.start('ME/APP');

    assert.equal(launches[0]?.folder, 'E:/repos/app');
  });

  it('keeps one server per project', async () => {
    const { servers, launches } = setUp({ checkouts: [APP, SITE] });

    await servers.start('me/app');
    await servers.start('me/site');

    assert.deepEqual(
      launches.map((each) => each.folder),
      ['E:/repos/app', 'E:/repos/site'],
    );
  });

  it('stops the whole process tree and forgets the server', async () => {
    const { servers, processes, answering, stopped, poll } = setUp();
    await servers.start('me/app');
    processes[0]?.print('Local: http://localhost:5173/');
    answering.add('http://localhost:5173/');
    await settle();
    await poll();

    const status = servers.stop('me/app');

    assert.deepEqual(status, stoppedApp);
    assert.deepEqual(stopped, [300]);
    assert.deepEqual(await servers.status('me/app'), stoppedApp);
  });

  it('does not report running, or poll again, when stopped while a probe was still out', async () => {
    const { servers, processes, answering, timers } = setUp();
    await servers.start('me/app');
    processes[0]?.print('Local: http://localhost:5173/');
    answering.add('http://localhost:5173/');
    await settle();
    const scheduled = timers.length;
    timers.findLast((timer) => timer.ms === POLL_MS)?.run();

    servers.stop('me/app');
    await settle();

    assert.equal((await servers.status('me/app')).state, 'stopped');
    assert.equal(timers.length, scheduled);
  });

  it('succeeds in stopping a server that is not running, and kills nothing', () => {
    const { servers, stopped } = setUp();

    assert.deepEqual(servers.stop('me/app'), stoppedApp);
    assert.deepEqual(stopped, []);
  });

  it('does not report a stopped server as failed when its process then ends', async () => {
    const { servers } = setUp();
    await servers.start('me/app');

    servers.stop('me/app');
    await settle();

    assert.equal((await servers.status('me/app')).state, 'stopped');
  });

  it('starts a fresh server after a stop', async () => {
    const { servers, launches } = setUp();
    await servers.start('me/app');
    servers.stop('me/app');

    await servers.start('me/app');

    assert.equal(launches.length, 2);
  });

  it('launches nothing when stopped while the checkout is still being looked up', async () => {
    let finishListing = (): void => undefined;
    const { servers, launches } = setUp({
      listing: new Promise((resolve) => (finishListing = resolve)),
    });

    const starting = servers.start('me/app');
    servers.stop('me/app');
    finishListing();

    assert.equal((await starting).state, 'stopped');
    assert.deepEqual(launches, []);
    assert.equal((await servers.status('me/app')).state, 'stopped');
  });

  it('says how a server ended, with its last words, and lets Run start it again', async () => {
    const { servers, processes, launches } = setUp();
    await servers.start('me/app');
    processes[0]?.print('Error: Cannot find module vite', '');
    await settle();

    processes[0]?.end(1);
    await settle();

    assert.deepEqual(await servers.status('me/app'), {
      repo: 'me/app',
      state: 'failed',
      reason:
        'The dev server exited with code 1. Its last output: "Error: Cannot find module vite"',
    });
    await servers.start('me/app');
    assert.equal(launches.length, 2);
    assert.equal((await servers.status('me/app')).state, 'starting');
  });

  it('reports a server that ends after it was running as failed, and does not kill it again', async () => {
    const { servers, processes, answering, stopped, poll } = setUp();
    await servers.start('me/app');
    processes[0]?.print('Local: http://localhost:5173/');
    answering.add('http://localhost:5173/');
    await settle();
    await poll();

    processes[0]?.end(0);
    await settle();

    assert.equal((await servers.status('me/app')).state, 'failed');
    servers.stop('me/app');
    assert.deepEqual(stopped, []);
  });

  it('waits a moment after the exit for the last output, so the reason holds the final line', async () => {
    const { servers, processes, timers } = setUp();
    await servers.start('me/app');
    processes[0]?.exitLeavingOutputOpen(1);
    processes[0]?.print('Error: EADDRINUSE');
    await settle();
    assert.equal((await servers.status('me/app')).state, 'starting');

    timers.findLast((timer) => timer.ms === OUTPUT_GRACE_MS && !timer.cancelled)?.run();

    assert.deepEqual(await servers.status('me/app'), {
      repo: 'me/app',
      state: 'failed',
      reason: 'The dev server exited with code 1. Its last output: "Error: EADDRINUSE"',
    });
  });

  it('ends as soon as the output closes after the exit, without waiting out the grace', async () => {
    const { servers, processes, timers } = setUp();
    await servers.start('me/app');
    processes[0]?.print('last words');

    processes[0]?.end(1);
    await settle();
    await settle();

    assert.deepEqual(await servers.status('me/app'), {
      repo: 'me/app',
      state: 'failed',
      reason: 'The dev server exited with code 1. Its last output: "last words"',
    });
    assert.ok(timers.every((timer) => timer.cancelled));
  });

  it('does not give two servers started together the same port', async () => {
    const { servers, launches } = setUp({ checkouts: [APP, SITE], ports: [4001, 4001, 4002] });

    await Promise.all([servers.start('me/app'), servers.start('me/site')]);

    assert.deepEqual(launches.map((each) => each.port).sort(), [4001, 4002]);
  });

  it('says so when every port it is offered is held by another server', async () => {
    const { servers, launches } = setUp({
      checkouts: [APP, SITE],
      ports: Array.from({ length: 11 }, () => 4001),
    });
    await servers.start('me/app');

    const status = await servers.start('me/site');

    assert.deepEqual(status, { repo: 'me/site', state: 'failed', reason: NO_PORT });
    assert.equal(launches.length, 1);
  });

  it('says why when the command could not be started at all', async () => {
    const { servers, processes } = setUp();
    await servers.start('me/app');

    processes[0]?.fail(new Error('spawn ENOENT'));

    assert.deepEqual(await servers.status('me/app'), {
      repo: 'me/app',
      state: 'failed',
      reason: 'Could not start "npm run dev": spawn ENOENT',
    });
  });

  it('says why a project with no local checkout cannot run, and starts nothing', async () => {
    const { servers, launches } = setUp({ checkouts: [] });

    const status = await servers.start('me/app');

    assert.deepEqual(status, { repo: 'me/app', state: 'unavailable', reason: NO_CHECKOUT });
    assert.deepEqual(launches, []);
    assert.deepEqual(await servers.status('me/app'), status, 'and is not kept as a failure');
  });

  it('reports a project with no checkout as unavailable, and one with a checkout as stopped', async () => {
    const { servers } = setUp({ checkouts: [APP] });

    assert.deepEqual(await servers.status('me/app'), stoppedApp);
    assert.deepEqual(await servers.status('me/site'), {
      repo: 'me/site',
      state: 'unavailable',
      reason: NO_CHECKOUT,
    });
  });

  it('says why a project with no runnable script cannot run, and starts nothing', async () => {
    const { servers, launches } = setUp({ command: null });

    const status = await servers.start('me/app');

    assert.deepEqual(status, { repo: 'me/app', state: 'failed', reason: NO_COMMAND });
    assert.deepEqual(launches, []);
  });

  it('reports a project as stopped, not as an error, when its checkout could not be looked up', async () => {
    const { servers } = setUp({ lookupFails: true });
    const logged = console.error;
    console.error = () => undefined;
    try {
      assert.deepEqual(await servers.status('me/app'), stoppedApp);
    } finally {
      console.error = logged;
    }
  });

  it('forgets a project that could not run when asked to stop it', async () => {
    const { servers } = setUp({ command: null });
    await servers.start('me/app');

    assert.deepEqual(servers.stop('me/app'), stoppedApp);
    assert.equal((await servers.status('me/app')).state, 'stopped');
  });

  it('gives up on a server whose site never answers, says where it looked and the last line, and stops its tree', async () => {
    const { servers, processes, limit, pollTimes, stopped } = setUp();
    await servers.start('me/app');
    processes[0]?.stdout.write('Port 4200 is already in use.\n');
    processes[0]?.stdout.write('? Would you like to use a different port? (Y/n) ');
    await settle();
    await pollTimes(3);

    limit()?.run();

    assert.deepEqual(await servers.status('me/app'), {
      repo: 'me/app',
      state: 'failed',
      reason: `Nothing answered at ${LOCAL} within two minutes, so the server was stopped. Its last output: "? Would you like to use a different port? (Y/n)". If the site is elsewhere, add a "url" for it to ~/.claude/observatory/run.json.`,
    });
    assert.deepEqual(stopped, [300]);
  });

  it('suggests run.json only when the server it gave up on printed nothing', async () => {
    const { servers, limit } = setUp();
    await servers.start('me/app');

    limit()?.run();

    assert.deepEqual(await servers.status('me/app'), {
      repo: 'me/app',
      state: 'failed',
      reason: NO_SITE,
    });
  });

  it('stops waiting for the site once it answers, and once it is stopped', async () => {
    const found = setUp();
    await found.servers.start('me/app');
    found.processes[0]?.print('Local: http://localhost:5173/');
    found.answering.add('http://localhost:5173/');
    await settle();
    await found.poll();
    const quit = setUp();
    await quit.servers.start('me/app');

    quit.servers.stop('me/app');

    assert.equal(found.limit()?.cancelled, true);
    assert.equal(quit.limit()?.cancelled, true);
    assert.ok(quit.timers.every((timer) => timer.cancelled));
  });

  it('kills every live server at once when the API exits', async () => {
    const { servers, processes, stoppedNow } = setUp({ checkouts: [APP, SITE] });
    await servers.start('me/app');
    await servers.start('me/site');
    processes[1]?.end(1);
    await settle();

    servers.shutdown();

    assert.deepEqual(stoppedNow, [300]);
    assert.equal((await servers.status('me/app')).state, 'stopped');
  });
});
