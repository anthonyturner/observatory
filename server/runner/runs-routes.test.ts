import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createApiHandler } from '../http/api-handler.ts';
import { fakeKiller, fakeLauncher } from './fake-process.ts';
import { NO_LONGER_VALID, type ProposalToken } from './proposals.ts';
import { RUN_LIMITS } from './run-limits.ts';
import { Runner } from './runner.ts';
import { RUNS_PATH, withRunsRoutes } from './runs-routes.ts';

const APP = { name: 'app', repo: 'me/app', folder: 'E:/repos/app' };
const BASE = `http://localhost${RUNS_PATH}`;
const WRITE = { 'x-observatory': '1', 'content-type': 'application/json' };
const PROMPT = 'Tidy the README';

function setUp() {
  const fakes = fakeLauncher();
  const runner = new Runner({
    launch: fakes.launch,
    killer: fakeKiller(fakes.started).killer,
    checkouts: { list: async () => [APP] },
    clock: () => 1_000,
    limits: { ...RUN_LIMITS, closeMs: 10, stopMs: 10 },
  });
  const handle = createApiHandler(withRunsRoutes({ get: {}, post: {} }, runner));
  const token = async (): Promise<ProposalToken> => {
    const { run } = await runner.offer({ prompt: PROMPT, repo: APP.repo });
    assert.ok(run);
    return run;
  };
  const start = (run: ProposalToken, headers: Record<string, string> = WRITE) =>
    handle(
      new Request(BASE, {
        method: 'POST',
        headers,
        body: JSON.stringify({ token: run.token, prompt: PROMPT, folder: run.folder }),
      }),
    );
  return { handle, runner, token, start, started: fakes.started };
}

const eventsOf = async (response: Response): Promise<{ n: number; kind: string }[]> =>
  (await response.text())
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line) as { n: number; kind: string });

describe('runs routes', () => {
  it('lists no runs to begin with', async () => {
    const { handle } = setUp();

    const response = await handle(new Request(BASE));

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { current: null, recent: [] });
  });

  it('starts a run from a token with 201, and lists it as current', async () => {
    const { handle, token, start } = setUp();

    const response = await start(await token());
    const run = (await response.json()) as { id: string; state: string; prompt: string };
    const list = (await (await handle(new Request(BASE))).json()) as { current: { id: string } };

    assert.equal(response.status, 201);
    assert.equal(run.state, 'starting');
    assert.equal(run.prompt, PROMPT);
    assert.equal(list.current.id, run.id);
  });

  it('answers 409 with the running run while one is going', async () => {
    const { token, start } = setUp();
    const first = (await (await start(await token())).json()) as { id: string };

    const busy = await start(await token());

    assert.equal(busy.status, 409);
    assert.deepEqual(await busy.json(), { error: 'a run is already going', run: first.id });
  });

  it('refuses a bad token with 403, a missing field with 400, and a start without the header', async () => {
    const { handle, token, start } = setUp();
    const run = await token();

    const forged = await start({ ...run, token: 'forged' });
    const missing = await handle(
      new Request(BASE, { method: 'POST', headers: WRITE, body: '{"token":"x"}' }),
    );
    const unheaded = await start(run, { 'content-type': 'application/json' });

    assert.equal(forged.status, 403);
    assert.deepEqual(await forged.json(), { error: NO_LONGER_VALID });
    assert.equal(missing.status, 400);
    assert.equal(unheaded.status, 403);
  });

  it('cancels a run with DELETE, only with the header, and 404 for an unknown one', async () => {
    const { handle, token, start } = setUp();
    const { id } = (await (await start(await token())).json()) as { id: string };
    const cancel = (runId: string, headers: Record<string, string> = WRITE) =>
      handle(new Request(`${BASE}?id=${runId}`, { method: 'DELETE', headers }));

    assert.equal((await cancel(id, {})).status, 403);
    const cancelled = await cancel(id);
    assert.equal(cancelled.status, 200);
    assert.equal(((await cancelled.json()) as { state: string }).state, 'stopping');
    assert.equal((await cancel('nope')).status, 404);
  });

  it('streams a run’s events as NDJSON, from an offset, until it ends', async () => {
    const { handle, token, start, started } = setUp();
    const { id } = (await (await start(await token())).json()) as { id: string };

    const response = await handle(new Request(`${BASE}?id=${id}&from=1`));
    started[0]?.print('{"type":"assistant"}');
    started[0]?.end(0);
    const events = await eventsOf(response);

    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), 'application/x-ndjson; charset=utf-8');
    assert.deepEqual(
      events.map((event) => [event.n, event.kind]),
      [
        [1, 'state'],
        [2, 'claude'],
        [3, 'state'],
      ],
    );
  });

  it('answers 404 for the events of an unknown run', async () => {
    const { handle } = setUp();

    const response = await handle(new Request(`${BASE}?id=nope`));

    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), { error: 'no such run' });
  });
});
