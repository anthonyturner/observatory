import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createApiHandler } from '../http/api-handler.ts';
import { guardLoopback } from '../http/loopback-guard.ts';
import type { DevServerControl, DevServerStatus, DevTarget } from './dev-server-types.ts';
import { DEV_SERVERS_PATH, withDevServerRoutes } from './dev-servers-routes.ts';

const BASE = `http://localhost${DEV_SERVERS_PATH}`;
const WRITE = { 'x-observatory': '1', 'content-type': 'application/json' };

const running = (target: DevTarget): DevServerStatus => ({
  ...target,
  state: 'running',
  url: 'http://localhost:5173/',
});
const label = ({ repo, pull }: DevTarget): string =>
  pull === undefined ? repo : `${repo}#${pull}`;

function setUp() {
  const calls: string[] = [];
  const servers: DevServerControl = {
    start: async (target) => {
      calls.push(`start ${label(target)}`);
      return running(target);
    },
    status: async (target) => {
      calls.push(`status ${label(target)}`);
      return running(target);
    },
    stop: async (target) => {
      calls.push(`stop ${label(target)}`);
      return { ...target, state: 'stopped' };
    },
  };
  const handle = createApiHandler(withDevServerRoutes({ get: {}, post: {} }, servers));
  const start = (body: unknown, headers: Record<string, string> = WRITE) =>
    handle(new Request(BASE, { method: 'POST', headers, body: JSON.stringify(body) }));
  const stop = (query: string) =>
    handle(new Request(`${BASE}?${query}`, { method: 'DELETE', headers: WRITE }));
  return { handle, start, stop, calls };
}

describe('dev server routes', () => {
  it('starts a project’s server and answers with where it stands', async () => {
    const { start, calls } = setUp();

    const response = await start({ repo: 'me/app' });

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), running({ repo: 'me/app' }));
    assert.deepEqual(calls, ['start me/app']);
  });

  it('reports a project’s server', async () => {
    const { handle, calls } = setUp();

    const response = await handle(new Request(`${BASE}?repo=me/app`));

    assert.equal(response.status, 200);
    assert.deepEqual(calls, ['status me/app']);
  });

  it('stops a project’s server, with the write header', async () => {
    const { stop, calls } = setUp();

    const response = await stop('repo=me/app');

    assert.deepEqual(await response.json(), { repo: 'me/app', state: 'stopped' });
    assert.deepEqual(calls, ['stop me/app']);
  });

  it('starts, reports and stops a pull request’s server by its number', async () => {
    const { handle, start, stop, calls } = setUp();

    const started = await start({ repo: 'me/app', pull: 12 });
    await handle(new Request(`${BASE}?repo=me/app&pull=12`));
    const stopped = await stop('repo=me/app&pull=12');

    assert.deepEqual(await started.json(), running({ repo: 'me/app', pull: 12 }));
    assert.deepEqual(await stopped.json(), { repo: 'me/app', pull: 12, state: 'stopped' });
    assert.deepEqual(calls, ['start me/app#12', 'status me/app#12', 'stop me/app#12']);
  });

  it('refuses a pull request number that is not a positive whole number, before touching a server', async () => {
    const { handle, start, stop, calls } = setUp();
    const notNumbers = [0, -3, 1.5, '1e3', '12abc', '', ' 7', '0x10', 'rm -rf', true, [], {}];

    for (const pull of notNumbers) {
      assert.equal((await start({ repo: 'me/app', pull })).status, 400, JSON.stringify(pull));
    }
    for (const pull of ['0', '-3', '1.5', '', '12;ls', '9999999999']) {
      const query = `repo=me/app&pull=${encodeURIComponent(pull)}`;
      assert.equal((await handle(new Request(`${BASE}?${query}`))).status, 400, pull);
      assert.equal((await stop(query)).status, 400, pull);
    }
    assert.deepEqual(calls, []);
  });

  it('treats a missing pull request number as the project’s own server', async () => {
    const { start, calls } = setUp();

    await start({ repo: 'me/app', pull: null });

    assert.deepEqual(calls, ['start me/app']);
  });

  it('refuses a start or a stop without the write header, before touching a server', async () => {
    const { handle, start, calls } = setUp();

    const started = await start(
      { repo: 'me/app', pull: 4 },
      { 'content-type': 'application/json' },
    );
    const stopped = await handle(new Request(`${BASE}?repo=me/app&pull=4`, { method: 'DELETE' }));

    assert.equal(started.status, 403);
    assert.equal(stopped.status, 403);
    assert.deepEqual(calls, []);
  });

  it('refuses a repo that is not an owner/name, so no folder or command can ride in on it', async () => {
    const { handle, start, calls } = setUp();

    assert.equal((await start({ repo: '../../etc' })).status, 400);
    assert.equal((await start({ repo: '-x/app' })).status, 400);
    assert.equal((await start({ folder: 'E:/repos/app' })).status, 400);
    assert.equal((await handle(new Request(BASE))).status, 400);
    assert.deepEqual(calls, []);
  });

  it('refuses a page that is not this machine’s own, once behind the loopback guard', async () => {
    const { handle, calls } = setUp();
    const guarded = guardLoopback(handle);
    const body = JSON.stringify({ repo: 'me/app', pull: 4 });
    const from = (origin: string, host: string) =>
      guarded(new Request(BASE, { method: 'POST', headers: { ...WRITE, origin, host }, body }));
    const withoutOrigin = guarded(
      new Request(BASE, { method: 'POST', headers: { ...WRITE, host: 'localhost:4319' }, body }),
    );

    assert.equal((await from('https://evil.example', 'localhost:4319')).status, 403);
    assert.equal((await from('http://localhost:4200', 'rebound.example')).status, 403);
    assert.equal((await withoutOrigin).status, 403);
    assert.deepEqual(calls, []);
    assert.equal((await from('http://localhost:4200', 'localhost:4319')).status, 200);
    assert.deepEqual(calls, ['start me/app#4']);
  });
});
