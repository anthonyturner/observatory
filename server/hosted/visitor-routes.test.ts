import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { ApiReads } from '../app/api-reads.ts';
import { type RouteTable, createApiHandler } from '../http/api-handler.ts';
import { PREVIEW_ONLY, visitorRoutes } from './visitor-routes.ts';

const owner: RouteTable = {
  get: {
    '/api/usage': async () => ({ secret: 'usage' }),
    '/api/logs': async () => ({ faults: [{ text: 'mail bob@example.com bounced' }] }),
    '/api/something-new': async () => ({ owner: 'only' }),
  },
  post: { '/api/triage': async () => ({}), '/api/another-write': async () => ({}) },
};

const reads = {
  history: async (repo: string) => ({ repo, frames: [] }),
  issue: async (repo: string, number: number) => ({ repo, number }),
} as unknown as ApiReads;
const visible = async () => new Set(['me/app']);

function visitor(logs: boolean) {
  return createApiHandler(visitorRoutes(owner, reads, visible, { privateRepos: false, logs }));
}

const get = (handle: ReturnType<typeof visitor>, path: string) =>
  handle(new Request(`https://x${path}`));

describe('visitorRoutes', () => {
  it('refuses every route it does not open, a new one included', async () => {
    const handle = visitor(false);

    for (const path of ['/api/something-new', '/api/logs']) {
      const response = await get(handle, path);
      assert.equal(response.status, 403, path);
      assert.deepEqual(await response.json(), { error: PREVIEW_ONLY });
    }
  });

  it('reads the owner’s usage as none', async () => {
    const response = await get(visitor(false), '/api/usage');

    assert.equal(response.status, 200);
    assert.equal(await response.json(), null);
  });

  it('refuses every write', async () => {
    const handle = visitor(false);
    for (const path of ['/api/triage', '/api/another-write']) {
      const response = await handle(
        new Request(`https://x${path}`, {
          method: 'POST',
          headers: { 'x-observatory': '1', 'content-type': 'application/json' },
          body: '{}',
        }),
      );
      assert.equal(response.status, 403, path);
    }
  });

  it('answers a repository it may not see as one that does not exist', async () => {
    const handle = visitor(false);

    assert.equal((await get(handle, '/api/history?repo=me/app')).status, 200);
    assert.equal((await get(handle, '/api/history?repo=me/secret')).status, 404);
    assert.equal((await get(handle, '/api/issue?repo=me/app&number=3')).status, 200);
    assert.equal((await get(handle, '/api/issue?repo=me/secret&number=3')).status, 404);
  });

  it('shows the logs through the second scrub when the owner chose to', async () => {
    const response = await get(visitor(true), '/api/logs');

    assert.deepEqual(await response.json(), { faults: [{ text: 'mail [hidden] bounced' }] });
    assert.equal((await get(visitor(true), '/api/logs?repo=me/secret')).status, 404);
  });
});
