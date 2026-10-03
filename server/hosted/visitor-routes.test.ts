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
    '/api/news': async () => ({ ai: [], engineering: [] }),
  },
  post: { '/api/triage': async () => ({}), '/api/another-write': async () => ({}) },
};

const reads = {
  history: async (repo: string) => ({ repo, frames: [] }),
  issue: async (repo: string, number: number) => ({ repo, number }),
  pullState: async () => ({ state: 'MERGED', title: 'Add a thing' }),
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

  it('reads the owner’s agent runs as none', async () => {
    const response = await get(visitor(false), '/api/agent-usage');

    assert.equal(response.status, 200);
    assert.equal(await response.json(), null);
  });

  it('shows the news, which is public headlines', async () => {
    const response = await get(visitor(false), '/api/news');

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ai: [], engineering: [] });
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

  it('says whether a pull request merged only in a repository it may see', async () => {
    const handle = visitor(false);

    const permitted = await get(handle, '/api/pull-state?repo=me/app&number=7');
    const refused = await get(handle, '/api/pull-state?repo=me/secret&number=7');

    assert.equal(permitted.status, 200);
    assert.deepEqual(await permitted.json(), { state: 'MERGED', title: 'Add a thing' });
    assert.equal(refused.status, 404);
    assert.deepEqual(await refused.json(), { error: 'no star map for me/secret' });
  });

  it('shows the logs through the second scrub when the owner chose to', async () => {
    const response = await get(visitor(true), '/api/logs');

    assert.deepEqual(await response.json(), { faults: [{ text: 'mail [hidden] bounced' }] });
    assert.equal((await get(visitor(true), '/api/logs?repo=me/secret')).status, 404);
  });
});
