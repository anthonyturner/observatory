import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createApiHandler } from '../http/api-handler.ts';
import { guardLoopback } from '../http/loopback-guard.ts';
import type { DevServerControl, DevServerStatus } from './dev-server-types.ts';
import { DEV_SERVERS_PATH, withDevServerRoutes } from './dev-servers-routes.ts';

const BASE = `http://localhost${DEV_SERVERS_PATH}`;
const WRITE = { 'x-observatory': '1', 'content-type': 'application/json' };

const running = (repo: string): DevServerStatus => ({
  repo,
  state: 'running',
  url: 'http://localhost:5173/',
});

function setUp() {
  const calls: string[] = [];
  const servers: DevServerControl = {
    start: async (repo) => {
      calls.push(`start ${repo}`);
      return running(repo);
    },
    status: (repo) => {
      calls.push(`status ${repo}`);
      return running(repo);
    },
    stop: (repo) => {
      calls.push(`stop ${repo}`);
      return { repo, state: 'stopped' };
    },
  };
  const handle = createApiHandler(withDevServerRoutes({ get: {}, post: {} }, servers));
  const start = (body: unknown, headers: Record<string, string> = WRITE) =>
    handle(new Request(BASE, { method: 'POST', headers, body: JSON.stringify(body) }));
  return { handle, start, calls };
}

describe('dev server routes', () => {
  it('starts a project’s server and answers with where it stands', async () => {
    const { start, calls } = setUp();

    const response = await start({ repo: 'me/app' });

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), running('me/app'));
    assert.deepEqual(calls, ['start me/app']);
  });

  it('reports a project’s server', async () => {
    const { handle, calls } = setUp();

    const response = await handle(new Request(`${BASE}?repo=me/app`));

    assert.equal(response.status, 200);
    assert.deepEqual(calls, ['status me/app']);
  });

  it('stops a project’s server, with the write header', async () => {
    const { handle, calls } = setUp();

    const response = await handle(
      new Request(`${BASE}?repo=me/app`, { method: 'DELETE', headers: WRITE }),
    );

    assert.deepEqual(await response.json(), { repo: 'me/app', state: 'stopped' });
    assert.deepEqual(calls, ['stop me/app']);
  });

  it('refuses a start or a stop without the write header, before touching a server', async () => {
    const { handle, start, calls } = setUp();

    const started = await start({ repo: 'me/app' }, { 'content-type': 'application/json' });
    const stopped = await handle(new Request(`${BASE}?repo=me/app`, { method: 'DELETE' }));

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
    const from = (origin: string, host: string) =>
      guarded(
        new Request(BASE, {
          method: 'POST',
          headers: { ...WRITE, origin, host },
          body: JSON.stringify({ repo: 'me/app' }),
        }),
      );
    const withoutOrigin = guarded(
      new Request(BASE, {
        method: 'POST',
        headers: { ...WRITE, host: 'localhost:4319' },
        body: JSON.stringify({ repo: 'me/app' }),
      }),
    );

    assert.equal((await from('https://evil.example', 'localhost:4319')).status, 403);
    assert.equal((await from('http://localhost:4200', 'rebound.example')).status, 403);
    assert.equal((await withoutOrigin).status, 403);
    assert.deepEqual(calls, []);
    assert.equal((await from('http://localhost:4200', 'localhost:4319')).status, 200);
    assert.deepEqual(calls, ['start me/app']);
  });
});
