import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Forbidden, NotFound } from '../http/api-handler.ts';
import type { Checkout } from './checkouts.ts';
import { RUN_COMMAND } from './claude-command.ts';
import type { Launch } from './claude-launcher.ts';
import { fakeKiller, fakeLauncher } from './fake-process.ts';
import { NO_LONGER_VALID, type ProposalToken } from './proposals.ts';
import { RUN_LIMITS, type RunLimits } from './run-limits.ts';
import { Runner, RunnerBusy } from './runner.ts';

const APP: Checkout = { name: 'app', repo: 'me/app', folder: 'E:/repos/app' };
const LIB: Checkout = { name: 'lib', repo: 'me/lib', folder: 'E:/repos/lib' };
const LIMITS: RunLimits = { ...RUN_LIMITS, closeMs: 10, stopMs: 10 };
const PROMPT = 'Fix the flaky test & say "done" 100%';

function setUp(options: { limits?: RunLimits; isKillEffective?: boolean; launch?: Launch } = {}) {
  let now = 1_000;
  let checkouts: readonly Checkout[] = [APP, LIB];
  const fakes = fakeLauncher();
  const kills = fakeKiller(fakes.started, { isEffective: options.isKillEffective ?? true });
  const runner = new Runner({
    launch: options.launch ?? fakes.launch,
    killer: kills.killer,
    checkouts: { list: async () => checkouts },
    clock: () => now,
    limits: options.limits ?? LIMITS,
  });
  return {
    runner,
    ...fakes,
    ...kills,
    advance: (ms: number) => (now += ms),
    setCheckouts: (list: readonly Checkout[]) => (checkouts = list),
    /** A token for `prompt` in `app`. */
    token: async (prompt = PROMPT): Promise<ProposalToken> => {
      const offer = await runner.offer({ prompt, repo: 'me/app' });
      assert.ok(offer.run);
      return offer.run;
    },
  };
}

const startWith = (runner: Runner, run: ProposalToken, prompt = PROMPT) =>
  runner.start({ token: run.token, prompt, folder: run.folder });

/** Resolves with every event line once run `id` has ended. */
const ended = (runner: Runner, id: string): Promise<string[]> =>
  new Promise((resolve) => {
    const lines: string[] = [];
    runner.follow(id, 0, (line) => (line === null ? resolve(lines) : lines.push(line)));
  });

const kindsOf = (lines: readonly string[]): string[] =>
  lines.map((line) => (JSON.parse(line) as { kind: string }).kind);

describe('Runner.offer', () => {
  it('hands out a token bound to the checkout, with the limit and the command', async () => {
    const { runner } = setUp();

    const offer = await runner.offer({ prompt: PROMPT, repo: 'Me/App' });

    assert.equal(offer.run?.folder, APP.folder);
    assert.equal(offer.run?.name, 'app');
    assert.equal(offer.run?.expiresAt, 1_000 + LIMITS.proposalMs);
    assert.equal(offer.run?.limitMs, LIMITS.runMs);
    assert.equal(offer.run?.command, RUN_COMMAND);
    assert.match(offer.run?.token ?? '', /^[\w-]{32}$/);
  });

  it('lists the repos with a checkout when the request names none', async () => {
    assert.deepEqual(await setUp().runner.offer({ prompt: PROMPT, repo: null }), {
      choose: ['me/app', 'me/lib'],
    });
  });

  it('says why when it cannot run: no claude, no checkouts, or none for that repo', async () => {
    const noClaude = new Runner({
      launch: null,
      killer: { stop: () => undefined, stopNow: () => undefined },
      checkouts: { list: async () => [APP] },
      clock: Date.now,
    });
    const empty = setUp();
    empty.setCheckouts([]);

    assert.match((await noClaude.offer({ prompt: PROMPT, repo: 'me/app' })).why ?? '', /PATH/);
    assert.match((await empty.runner.offer({ prompt: PROMPT, repo: null })).why ?? '', /checkout/);
    assert.match(
      (await setUp().runner.offer({ prompt: PROMPT, repo: 'me/other' })).why ?? '',
      /no local checkout/,
    );
  });
});

describe('Runner.start', () => {
  it('runs claude in the checkout with the prompt on stdin, and reports it', async () => {
    const { runner, started, folders, token } = setUp();

    const run = await startWith(runner, await token());
    const [claude] = started;
    claude?.print(
      '{"type":"system"}',
      'not json',
      '{"type":"result","is_error":false,"total_cost_usd":0.25,"num_turns":3,"duration_ms":900}',
    );
    claude?.end(0);
    const lines = await ended(runner, run.id);

    assert.equal(run.state, 'starting');
    assert.deepEqual(folders, [APP.folder]);
    assert.equal(claude?.received, PROMPT);
    assert.deepEqual(kindsOf(lines), ['state', 'state', 'claude', 'text', 'claude', 'state']);
    const [finished] = runner.report().recent;
    assert.equal(finished?.state, 'done');
    assert.equal(finished?.code, 0);
    assert.deepEqual(finished?.result, {
      error: false,
      subtype: null,
      costUsd: 0.25,
      turns: 3,
      durationMs: 900,
    });
  });

  it('logs standard error, and keeps only the head of a line over lineBytes', async () => {
    const { runner, started, token } = setUp({ limits: { ...LIMITS, lineBytes: 1_000 } });
    const run = await startWith(runner, await token());

    started[0]?.stderr.write('hook warning\n\n');
    started[0]?.print(`{"huge":"${'x'.repeat(2_000)}"}`);
    started[0]?.end(0);
    const events = (await ended(runner, run.id)).map(
      (line) => JSON.parse(line) as { kind: string; data: { size?: number } },
    );

    assert.deepEqual(
      events.filter((event) => event.kind === 'stderr').map((event) => event.data),
      ['hook warning'],
    );
    assert.equal(events.find((event) => event.kind === 'cut')?.data.size, 2_011);
  });

  it('refuses a used token, and starts nothing more', async () => {
    const { runner, started, token } = setUp();
    const run = await token();
    const first = await startWith(runner, run);
    started[0]?.end(0);
    await ended(runner, first.id);

    await assert.rejects(startWith(runner, run), new Forbidden(NO_LONGER_VALID));
    assert.equal(started.length, 1);
  });

  it('refuses an expired token', async () => {
    const { runner, started, token, advance } = setUp();
    const run = await token();
    advance(LIMITS.proposalMs);

    await assert.rejects(startWith(runner, run), Forbidden);
    assert.equal(started.length, 0);
  });

  it('refuses a changed prompt or folder, and spends the token doing so', async () => {
    const { runner, started, token } = setUp();
    const byPrompt = await token();
    const byFolder = await token();

    await assert.rejects(startWith(runner, byPrompt, 'Delete everything'), Forbidden);
    await assert.rejects(
      runner.start({ token: byFolder.token, prompt: PROMPT, folder: LIB.folder }),
      Forbidden,
    );
    await assert.rejects(startWith(runner, byPrompt), Forbidden);
    await assert.rejects(startWith(runner, byFolder), Forbidden);
    assert.equal(started.length, 0);
  });

  it('checks the folder is still a checkout when the token is used', async () => {
    const { runner, started, token, setCheckouts } = setUp();
    const run = await token();
    setCheckouts([LIB]);

    await assert.rejects(startWith(runner, run), /no longer a local checkout/);
    assert.equal(started.length, 0);
  });

  it('runs one at a time, and keeps a waiting proposal until the run ends', async () => {
    const { runner, started, token } = setUp();
    const first = await startWith(runner, await token());
    const waiting = await token('Another task');

    await assert.rejects(startWith(runner, waiting, 'Another task'), new RunnerBusy(first.id));
    started[0]?.end(0);
    await ended(runner, first.id);
    const second = await startWith(runner, waiting, 'Another task');

    assert.equal(second.state, 'starting');
    assert.equal(started.length, 2);
  });

  it('ends a run that fails to start, and frees the runner', async () => {
    const { runner, token } = setUp({
      launch: () => {
        throw new Error('spawn EACCES');
      },
    });

    const run = await startWith(runner, await token());

    assert.equal(run.state, 'failed');
    assert.equal(run.why, 'Claude Code could not start: spawn EACCES');
    assert.equal(runner.report().current, null);
  });

  it('says a run failed with the exit code it gave', async () => {
    const { runner, started, token } = setUp();
    const run = await startWith(runner, await token());
    started[0]?.end(2);
    await ended(runner, run.id);

    const [failed] = runner.report().recent;
    assert.equal(failed?.state, 'failed');
    assert.equal(failed?.why, 'Claude Code exited with code 2');
  });

  it('ends a run whose output a grandchild holds open, closeMs after it exits', async () => {
    const { runner, started, token } = setUp();
    const run = await startWith(runner, await token());

    started[0]?.exitLeavingOutputOpen(0);
    await ended(runner, run.id);

    assert.equal(runner.report().recent[0]?.state, 'done');
  });
});

describe('Runner stopping', () => {
  it('stops a run at the time limit, and kills its tree', async () => {
    const { runner, stopped, token } = setUp({ limits: { ...LIMITS, runMs: 20 } });
    const run = await startWith(runner, await token());

    const lines = await ended(runner, run.id);

    assert.deepEqual(stopped, [100]);
    assert.equal(runner.report().recent[0]?.state, 'time-limit');
    assert.ok(lines.some((line) => line.includes('"stopping":"time-limit"')));
  });

  it('cancels a run, and says so', async () => {
    const { runner, stopped, token } = setUp();
    const run = await startWith(runner, await token());

    runner.cancel(run.id);
    await ended(runner, run.id);

    assert.deepEqual(stopped, [100]);
    assert.equal(runner.report().recent[0]?.state, 'cancelled');
    assert.throws(() => runner.cancel('nope'), NotFound);
  });

  it('tries a failed kill once more, then ends the run anyway and says to check', async () => {
    const { runner, stopped, token } = setUp({ isKillEffective: false });
    const run = await startWith(runner, await token());

    runner.cancel(run.id);
    await ended(runner, run.id);

    assert.deepEqual(stopped, [100, 100]);
    const [gaveUp] = runner.report().recent;
    assert.equal(gaveUp?.state, 'cancelled');
    assert.match(gaveUp?.why ?? '', /could not confirm/);
    assert.equal(runner.report().current, null);
  });

  it('kills the live run at once when the server stops', async () => {
    const { runner, stoppedNow, token } = setUp();
    await startWith(runner, await token());

    runner.shutdown();

    assert.deepEqual(stoppedNow, [100]);
  });
});

describe('Runner.report', () => {
  it('keeps the last few runs, newest first, beside the current one', async () => {
    const { runner, started, token } = setUp({ limits: { ...LIMITS, recent: 2 } });
    const ids: string[] = [];
    for (let index = 0; index < 3; index++) {
      const run = await startWith(runner, await token());
      ids.push(run.id);
      started[index]?.end(0);
      await ended(runner, run.id);
    }
    const live = await startWith(runner, await token());

    const report = runner.report();
    assert.equal(report.current?.id, live.id);
    assert.deepEqual(
      report.recent.map((run) => run.id),
      [ids[2], ids[1]],
    );
    assert.equal(runner.has(ids[0] ?? ''), false);
  });
});
