import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { NotFound, createApiHandler } from '../http/api-handler.ts';
import type { DepthReports } from './depth-report.ts';
import { DEPTH_PATH, withDepthRoutes } from './depth-routes.ts';
import type { DepthReport } from './depth-types.ts';

const report = (repo: string): DepthReport => ({
  repo,
  scannedAt: '2026-10-08T12:00:00.000Z',
  modules: [],
  principles: [],
});

function setup() {
  const forgotten: string[] = [];
  const depth: DepthReports = {
    read: async (repo) => {
      if (repo === 'me/none') throw new NotFound('No local clone of me/none.');
      return report(repo);
    },
    forget: (repo) => forgotten.push(repo),
  };
  const handle = createApiHandler(withDepthRoutes({ get: {}, post: {} }, depth));
  const get = (query: string) => handle(new Request(`https://x${DEPTH_PATH}${query}`));
  return { forgotten, get };
}

describe('withDepthRoutes', () => {
  it("answers with the repository's report", async () => {
    const response = await setup().get('?repo=me/app');

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), report('me/app'));
  });

  it('forgets the repository first when asked for a fresh read', async () => {
    const { forgotten, get } = setup();

    await get('?repo=me/app');
    assert.deepEqual(forgotten, []);
    await get('?repo=me/app&fresh=1');
    assert.deepEqual(forgotten, ['me/app']);
  });

  it('answers 404 when there is no clone, and 400 for a repo that is not owner/name', async () => {
    const { get } = setup();

    assert.equal((await get('?repo=me/none')).status, 404);
    assert.equal((await get('?repo=nonsense')).status, 400);
    assert.equal((await get('')).status, 400);
  });
});
