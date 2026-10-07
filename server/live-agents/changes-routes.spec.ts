import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createApiHandler } from '../http/api-handler.ts';
import type { ChangesSource } from './agent-changes.ts';
import { AGENT_CHANGES_PATH, withAgentChangesRoutes } from './changes-routes.ts';
import type { AgentKey } from './live-agent-types.ts';

const SESSION = '11111111-1111-4111-8111-111111111111';

function setUp() {
  const asked: AgentKey[] = [];
  const source: ChangesSource = {
    changes: async (key) => {
      asked.push(key);
      return {
        generatedAt: `read ${asked.length}`,
        changes: { kind: 'problem', problem: 'no-folder', folder: null },
      };
    },
  };
  const handle = createApiHandler(withAgentChangesRoutes({ get: {}, post: {} }, source));
  const get = (query: string) =>
    handle(new Request(`http://localhost${AGENT_CHANGES_PATH}${query}`));
  return { get, asked };
}

describe('agent changes route', () => {
  it('reads one agent by its ids, once for callers arriving close together', async () => {
    const { get, asked } = setUp();

    const first = await (await get(`?session=${SESSION}&agent=AB12`)).json();
    const second = await (await get(`?session=${SESSION}&agent=ab12`)).json();
    await get(`?session=${SESSION}`);

    assert.deepEqual(first, {
      generatedAt: 'read 1',
      changes: { kind: 'problem', problem: 'no-folder', folder: null },
    });
    assert.deepEqual(second, first);
    assert.deepEqual(asked, [
      { session: SESSION, agentId: 'ab12' },
      { session: SESSION, agentId: null },
    ]);
  });

  it('refuses a request that names a folder, or bad ids, before anything is read', async () => {
    const { get, asked } = setUp();
    const bad = [
      `?session=${SESSION}&folder=C%3A%2FUsers`,
      `?session=${SESSION}&cwd=..%2F..`,
      `?session=${SESSION}&path=%2Fetc`,
      '?session=..%2F..%2Fsecrets',
      `?session=${SESSION}&agent=..%2Fx`,
      '?folder=C%3A%2F',
    ];

    for (const query of bad) assert.equal((await get(query)).status, 400, query);
    assert.deepEqual(asked, []);
  });
});
