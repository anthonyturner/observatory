import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, describe, it } from 'node:test';
import { createApiHandler } from '../http/api-handler.ts';
import { agentFeedReader } from './feed-reader.ts';
import {
  type AgentFeedSource,
  LIVE_AGENT_FEED_PATH,
  withLiveAgentFeedRoute,
} from './feed-routes.ts';
import type { AgentKey } from './live-agent-types.ts';

const SESSION = '11111111-1111-4111-8111-111111111111';

function setUp(source?: AgentFeedSource) {
  const asked: [AgentKey, number | null][] = [];
  const recording: AgentFeedSource = {
    feed: async (key, from) => {
      asked.push([key, from]);
      return { events: [], next: 0, isRestart: from === null };
    },
  };
  const handle = createApiHandler(
    withLiveAgentFeedRoute({ get: {}, post: {} }, source ?? recording),
  );
  const get = (query: string) =>
    handle(new Request(`http://localhost${LIVE_AGENT_FEED_PATH}${query}`));
  return { get, asked };
}

const root = mkdtempSync(join(tmpdir(), 'feed-routes-'));
after(() => rmSync(root, { recursive: true, force: true }));

describe('live agent feed route', () => {
  it('passes the ids and the cursor on, a first load having none', async () => {
    const { get, asked } = setUp();

    assert.equal((await get(`?session=${SESSION}&agent=AB12&from=4096`)).status, 200);
    assert.equal((await get(`?session=${SESSION}`)).status, 200);

    assert.deepEqual(asked, [
      [{ session: SESSION, agentId: 'ab12' }, 4096],
      [{ session: SESSION, agentId: null }, null],
    ]);
  });

  it('refuses a bad id or cursor before reading anything', async () => {
    const { get, asked } = setUp();
    const bad = [
      '?session=..%2F..%2Fsecrets',
      `?session=${SESSION}&agent=..%2Fx`,
      `?session=${SESSION}&from=-1`,
      `?session=${SESSION}&from=1.5`,
      `?session=${SESSION}&from=`,
      `?session=${SESSION}&from=1e9`,
      `?session=${SESSION}&from=9999999999999999`,
    ];

    for (const query of bad) assert.equal((await get(query)).status, 400, query);
    assert.deepEqual(asked, []);
  });

  it('reads the transcript the ids name, and nothing for ids no transcript has', async () => {
    const project = join(root, 'e--repos-app');
    mkdirSync(project, { recursive: true });
    const said = { type: 'assistant', message: { content: [{ type: 'text', text: 'hi' }] } };
    writeFileSync(join(project, `${SESSION}.jsonl`), `${JSON.stringify(said)}\n`);
    const { get } = setUp(agentFeedReader(root));

    const found = (await (await get(`?session=${SESSION}`)).json()) as { events: unknown };
    const missing = await (await get(`?session=${SESSION}&agent=ab12`)).json();

    assert.deepEqual(found.events, [said]);
    assert.deepEqual(missing, { events: [], next: null, isRestart: true });
  });
});
