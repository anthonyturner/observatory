import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createApiHandler } from '../http/api-handler.ts';
import type { AgentKey } from './live-agent-types.ts';
import {
  LIVE_AGENTS_PATH,
  type LiveAgentsSource,
  withLiveAgentsRoutes,
} from './live-agents-routes.ts';

const SESSION = '11111111-1111-4111-8111-111111111111';

function setUp() {
  const asked: AgentKey[] = [];
  let lists = 0;
  const source: LiveAgentsSource = {
    list: async () => ({ generatedAt: `read ${++lists}`, agents: [] }),
    one: async (key) => {
      asked.push(key);
      return { generatedAt: '', agent: null };
    },
  };
  const handle = createApiHandler(withLiveAgentsRoutes({ get: {}, post: {} }, source));
  const get = (query = '') => handle(new Request(`http://localhost${LIVE_AGENTS_PATH}${query}`));
  return { get, asked };
}

describe('live agents routes', () => {
  it('answers the list, read once for callers arriving close together', async () => {
    const { get } = setUp();

    const first = await (await get()).json();
    const second = await (await get()).json();

    assert.deepEqual(first, { generatedAt: 'read 1', agents: [] });
    assert.deepEqual(second, first);
  });

  it('opens one agent by its session and subagent ids', async () => {
    const { get, asked } = setUp();

    const response = await get(`?session=${SESSION.toUpperCase()}&agent=A1B2`);

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { generatedAt: '', agent: null });
    assert.deepEqual(asked, [{ session: SESSION, agentId: 'a1b2' }]);
  });

  it('refuses anything but a session UUID and a hex subagent id, before reading anything', async () => {
    const { get, asked } = setUp();
    const bad = [
      '?session=..%2F..%2Fsecrets',
      '?session=not-a-uuid',
      `?session=${SESSION}%2F..`,
      `?session=${SESSION}&agent=..%2F..%2Fx`,
      `?session=${SESSION}&agent=xyz`,
      `?session=${SESSION}&agent=`,
      '?agent=a1b2',
    ];

    for (const query of bad) assert.equal((await get(query)).status, 400, query);
    assert.deepEqual(asked, []);
  });
});
