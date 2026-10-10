import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { NotFound, createApiHandler } from '../http/api-handler.ts';
import type { ArchitectureMaps } from './architecture-maps.ts';
import {
  ARCHITECTURE_HTML_PATH,
  ARCHITECTURE_PATH,
  withArchitectureRoutes,
} from './architecture-routes.ts';
import { SAMPLE_MAP } from './sample-map.ts';
import type { ArchitectureMap } from './architecture-types.ts';

function setup() {
  const forgotten: string[] = [];
  const rendered: ArchitectureMap[] = [];
  const maps: ArchitectureMaps = {
    read: async (repo) => {
      if (repo === 'me/none') throw new NotFound('No local clone of me/none.');
      return { ...SAMPLE_MAP, project: repo };
    },
    forget: (repo) => forgotten.push(repo),
  };
  const handle = createApiHandler(
    withArchitectureRoutes({ get: {}, post: {} }, maps, async (map) => {
      rendered.push(map);
      return `<html>${map.project}</html>`;
    }),
  );
  const get = (path: string, query: string) => handle(new Request(`https://x${path}${query}`));
  return { forgotten, rendered, get };
}

describe('withArchitectureRoutes', () => {
  it("answers with the repository's map", async () => {
    const response = await setup().get(ARCHITECTURE_PATH, '?repo=me/app');

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ...SAMPLE_MAP, project: 'me/app' });
  });

  it('forgets the repository first when asked for a fresh scan', async () => {
    const { forgotten, get } = setup();

    await get(ARCHITECTURE_PATH, '?repo=me/app');
    assert.deepEqual(forgotten, []);
    await get(ARCHITECTURE_PATH, '?repo=me/app&fresh=1');
    assert.deepEqual(forgotten, ['me/app']);
  });

  it('serves the viewer page for the repository as HTML', async () => {
    const { rendered, get } = setup();

    const response = await get(ARCHITECTURE_HTML_PATH, '?repo=me/app');

    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type') ?? '', /^text\/html/);
    assert.equal(await response.text(), '<html>me/app</html>');
    assert.equal(rendered[0]?.project, 'me/app');
  });

  it('lets the viewer page run its own script but call nothing, even this API', async () => {
    const response = await setup().get(ARCHITECTURE_HTML_PATH, '?repo=me/app');

    const policy = response.headers.get('content-security-policy') ?? '';
    assert.match(policy, /script-src 'unsafe-inline'/);
    assert.match(policy, /connect-src 'none'/);
    assert.match(policy, /default-src 'none'/);
  });

  it('answers 404 when there is no clone, and 400 for a repo that is not owner/name', async () => {
    const { get } = setup();

    for (const path of [ARCHITECTURE_PATH, ARCHITECTURE_HTML_PATH]) {
      assert.equal((await get(path, '?repo=me/none')).status, 404);
      assert.equal((await get(path, '?repo=nonsense')).status, 400);
      assert.equal((await get(path, '')).status, 400);
    }
  });
});
