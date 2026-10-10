import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { NO_CHECKOUT, NO_COMMAND } from './dev-reasons.ts';
import { APP, SITE, START_LIMIT_MS, setUp, settle, worktreeOf } from './dev-servers-fixture.ts';
import type { PrepareRequest, Prepared } from './pull-worktrees.ts';

const CLONE = APP.folder;
const PULL = { repo: 'me/app', pull: 12 };
const FOLDER = worktreeOf(CLONE, 12);
const GONE_WAIT_MS = 15_000;
const SEEN = 'http://localhost:5173/';

/** A preparation the test finishes by hand, so what happens meanwhile can be seen. */
function heldPreparation() {
  let finish: (prepared: Prepared) => void = () => undefined;
  let request: PrepareRequest | undefined;
  const prepare = (asked: PrepareRequest): Promise<Prepared> => {
    request = asked;
    return new Promise((resolve) => (finish = resolve));
  };
  return { prepare, finish: (prepared: Prepared) => finish(prepared), request: () => request };
}

describe('DevServers for a pull request', () => {
  it('keeps a server for the checkout and one for each pull request, whatever the case of the repository', async () => {
    const { servers, prepares } = setUp();

    await servers.start({ repo: 'me/app' });
    await servers.start(PULL);
    await servers.start({ repo: 'me/app', pull: 13 });
    const again = await servers.start({ repo: 'ME/App', pull: 12 });

    assert.deepEqual(
      prepares.map((each) => each.pull),
      [12, 13],
    );
    assert.equal(again.state, 'starting');
    assert.equal((await servers.status({ repo: 'me/app' })).pull, undefined);
    assert.equal((await servers.status({ repo: 'me/app', pull: 13 })).pull, 13);
  });

  it('answers at once while the worktree is made, and shows each phase until the site answers', async () => {
    const held = heldPreparation();
    const { servers, launches, processes, answering, poll } = setUp({ prepare: held.prepare });

    const started = await servers.start(PULL);

    assert.deepEqual(started, { ...PULL, state: 'starting', phase: 'fetching' });
    assert.deepEqual(launches, []);
    held.request()?.onPhase('installing');
    assert.deepEqual(await servers.status(PULL), {
      ...PULL,
      state: 'starting',
      phase: 'installing',
    });
    held.finish({ folder: FOLDER });
    await settle();
    assert.deepEqual(await servers.status(PULL), { ...PULL, state: 'starting', phase: 'starting' });
    assert.deepEqual(launches, [{ folder: FOLDER, command: 'npm run dev', port: 54321 }]);
    processes[0]?.print(`Local: ${SEEN}`);
    answering.add(SEEN);
    await settle();
    await poll();
    assert.deepEqual(await servers.status(PULL), { ...PULL, state: 'running', url: SEEN });
  });

  it('asks for the registry’s clone and the number, and tells which other pull requests are in use', async () => {
    const { servers, prepares } = setUp();
    await servers.start({ repo: 'me/app', pull: 5 });

    await servers.start(PULL);

    assert.equal(prepares[1]?.clone, CLONE);
    assert.equal(prepares[1]?.repo, 'me/app');
    assert.equal(prepares[1]?.pull, 12);
    assert.deepEqual(
      prepares[1]?.inUse.toSorted((a, b) => a - b),
      [5, 12],
    );
  });

  it('counts the start limit from the server’s launch, not from the install', async () => {
    const held = heldPreparation();
    const { servers, limit } = setUp({ prepare: held.prepare });
    await servers.start(PULL);
    assert.equal(limit(), undefined);

    held.finish({ folder: FOLDER });
    await settle();

    assert.equal(limit()?.ms, START_LIMIT_MS);
  });

  it('reports a failed install with its last output line, launches nothing, and lets Preview try again', async () => {
    const why =
      'Installing the dependencies of pull request 12 (npm ci) exited with code 1. Its last output: "npm error 404 Not Found"';
    const { servers, launches, prepares } = setUp({ prepare: async () => ({ why }) });

    await servers.start(PULL);
    await settle();

    assert.deepEqual(await servers.status(PULL), { ...PULL, state: 'failed', reason: why });
    assert.deepEqual(launches, []);
    await servers.start(PULL);
    assert.equal(prepares.length, 2);
  });

  it('says why a pull request’s worktree has no script to run', async () => {
    const { servers, launches } = setUp({ command: null });

    await servers.start(PULL);
    await settle();

    assert.deepEqual(await servers.status(PULL), { ...PULL, state: 'failed', reason: NO_COMMAND });
    assert.deepEqual(launches, []);
  });

  it('looks for the command in the worktree', async () => {
    const { servers, asked } = setUp();

    await servers.start(PULL);
    await settle();

    assert.deepEqual(asked, [{ repo: 'me/app', folder: FOLDER }]);
  });

  it('reports a pull request of a project with no checkout as unavailable, and prepares nothing', async () => {
    const { servers, prepares } = setUp({ checkouts: [SITE] });

    const status = await servers.start(PULL);

    assert.deepEqual(status, { ...PULL, state: 'unavailable', reason: NO_CHECKOUT });
    assert.deepEqual(prepares, []);
  });

  it('turns a worktree that could not be made at all into a failure, not an error', async () => {
    const { servers } = setUp({
      prepare: async () => {
        throw new Error('disk full');
      },
    });

    await servers.start(PULL);
    await settle();

    const status = await servers.status(PULL);
    assert.equal(status.state, 'failed');
    assert.match(status.state === 'failed' ? status.reason : '', /disk full/);
  });

  it('ends the server, waits for it to be gone, and then removes the worktree', async () => {
    const { servers, removals, stopped } = setUp();
    await servers.start(PULL);
    await settle();

    const status = await servers.stop(PULL);

    assert.deepEqual(status, { ...PULL, state: 'stopped' });
    assert.deepEqual(stopped, [300]);
    assert.deepEqual(removals, [{ clone: CLONE, pull: 12 }]);
    assert.equal((await servers.status(PULL)).state, 'stopped');
  });

  it('holds back the removal while the killed server is still there, until the wait runs out', async () => {
    const { servers, removals, timers } = setUp({ isKillEffective: false });
    await servers.start(PULL);
    await settle();

    const stopping = servers.stop(PULL);
    await settle();
    assert.deepEqual(removals, []);
    timers.findLast((timer) => timer.ms === GONE_WAIT_MS)?.run();

    assert.equal((await stopping).state, 'stopped');
    assert.equal(removals.length, 1);
  });

  it('aborts a preparation that is stopped, then removes what it made, and launches nothing', async () => {
    const held = heldPreparation();
    const { servers, launches, removals } = setUp({ prepare: held.prepare });
    await servers.start(PULL);

    const stopping = servers.stop(PULL);
    await settle();
    assert.equal(held.request()?.signal.aborted, true);
    assert.deepEqual(removals, []);
    held.finish({ why: 'was ended' });

    assert.equal((await stopping).state, 'stopped');
    assert.deepEqual(removals, [{ clone: CLONE, pull: 12 }]);
    assert.deepEqual(launches, []);
    assert.equal((await servers.status(PULL)).state, 'stopped');
  });

  it('does not start again until the stop before it has removed the worktree', async () => {
    let finishRemoval = (): void => undefined;
    const removing = new Promise<void>((resolve) => (finishRemoval = resolve));
    const { servers, prepares, removals } = setUp({ removing });
    await servers.start(PULL);
    await settle();

    const stopping = servers.stop(PULL);
    const restarting = servers.start(PULL);
    await settle();
    assert.equal(prepares.length, 1);
    finishRemoval();
    await stopping;
    await restarting;
    await settle();

    assert.equal(removals.length, 1);
    assert.equal(prepares.length, 2);
  });

  it('says so when the worktree could not be removed, and still ends the server', async () => {
    const reason = 'The worktree of pull request 12 could not be removed: EBUSY';
    const { servers, stopped } = setUp({ removalFails: reason });
    await servers.start(PULL);
    await settle();

    const status = await servers.stop(PULL);

    assert.deepEqual(stopped, [300]);
    assert.deepEqual(status, { ...PULL, state: 'failed', reason });
  });

  it('removes the worktree a past run left, when stopped with no server of its own', async () => {
    const { servers, removals } = setUp();

    const status = await servers.stop(PULL);

    assert.deepEqual(status, { ...PULL, state: 'stopped' });
    assert.deepEqual(removals, [{ clone: CLONE, pull: 12 }]);
  });

  it('removes no worktree when the project’s own server is stopped', async () => {
    const { servers, removals } = setUp();
    await servers.start({ repo: 'me/app' });

    await servers.stop({ repo: 'me/app' });

    assert.deepEqual(removals, []);
  });

  it('leaves the worktrees when the API exits, and ends what git and npm are doing', async () => {
    const { servers, removals, stoppedNow, shutdowns } = setUp();
    await servers.start(PULL);
    await settle();

    servers.shutdown();

    assert.deepEqual(stoppedNow, [300]);
    assert.deepEqual(removals, []);
    assert.deepEqual(shutdowns, ['tools']);
  });
});
