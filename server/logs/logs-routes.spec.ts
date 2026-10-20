import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { WRITE_HEADER, createApiHandler } from '../http/api-handler.ts';
import type { LogClears } from './log-clears.ts';
import { LOGS_CLEAR_PATH, withLogClearRoutes } from './logs-routes.ts';

const URL_OF = (query = '') => `http://x${LOGS_CLEAR_PATH}${query}`;
const WRITE = { [WRITE_HEADER]: '1', 'content-type': 'application/json' };

function setup() {
  const stored = new Map<string, string>();
  const forgotten: string[] = [];
  const clears: LogClears = {
    clearedAt: async (repo) => stored.get(repo) ?? null,
    clear: async (repo, at) => void stored.set(repo, at),
    reset: async (repo) => void stored.delete(repo),
  };
  const handle = createApiHandler(
    withLogClearRoutes(
      { get: {}, post: {} },
      {
        clears,
        forgetLogs: (repo) => forgotten.push(repo),
        now: () => new Date(2026, 9, 20, 9, 30, 0),
      },
    ),
  );
  return { stored, forgotten, handle };
}

const post = (repo: unknown) =>
  new Request(URL_OF(), { method: 'POST', headers: WRITE, body: JSON.stringify({ repo }) });

describe('withLogClearRoutes', () => {
  it('records now in the log’s own form, drops the cached logs and answers at once', async () => {
    const { stored, forgotten, handle } = setup();

    const response = await handle(post('me/app'));

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { clearedAt: '2026-10-20T09:30:00' });
    assert.equal(stored.get('me/app'), '2026-10-20T09:30:00');
    assert.deepEqual(forgotten, ['me/app']);
  });

  it('resets a clear, and drops the cached logs', async () => {
    const { stored, forgotten, handle } = setup();
    await handle(post('me/app'));

    const response = await handle(
      new Request(URL_OF('?repo=me/app'), { method: 'DELETE', headers: WRITE }),
    );

    assert.equal(response.status, 200);
    assert.equal(stored.has('me/app'), false);
    assert.deepEqual(forgotten, ['me/app', 'me/app']);
  });

  it('refuses a request without the write header, and a repository that is not a name', async () => {
    const { stored, handle } = setup();

    const bare = await handle(new Request(URL_OF(), { method: 'POST', body: '{}' }));
    const nameless = await handle(post('nope'));
    const namelessReset = await handle(
      new Request(URL_OF('?repo=nope'), { method: 'DELETE', headers: WRITE }),
    );

    assert.equal(bare.status, 403);
    assert.equal(nameless.status, 400);
    assert.equal(namelessReset.status, 400);
    assert.equal(stored.size, 0);
  });

  it('refuses a reset without the write header, and leaves the clear in place', async () => {
    const { stored, forgotten, handle } = setup();
    await handle(post('me/app'));

    const bare = await handle(new Request(URL_OF('?repo=me/app'), { method: 'DELETE' }));

    assert.equal(bare.status, 403);
    assert.equal(stored.get('me/app'), '2026-10-20T09:30:00');
    assert.deepEqual(forgotten, ['me/app']);
  });
});
