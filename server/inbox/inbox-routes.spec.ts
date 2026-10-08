import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { InboxMarker } from '../github/inbox-marker.ts';
import { createApiHandler } from '../http/api-handler.ts';
import type { InboxReport } from './inbox-types.ts';
import { instantFrom, threadIdFrom, withInboxRoutes } from './inbox-routes.ts';

const REPORT: InboxReport = {
  generatedAt: '2026-10-08T12:00:00.000Z',
  status: 'read',
  note: null,
  items: [],
  isCapped: false,
};

function setUp(marker: Partial<InboxMarker> = {}) {
  const events: string[] = [];
  const handle = createApiHandler(
    withInboxRoutes(
      { get: {}, post: {} },
      {
        inbox: async () => {
          events.push('read');
          return REPORT;
        },
        forgetInbox: () => void events.push('forget'),
      },
      {
        markThreadRead: async (id) => void events.push(`mark ${id}`),
        markAllRead: async (before) => void events.push(`mark all ${before}`),
        ...marker,
      },
    ),
  );
  const post = (path: string, body: unknown) =>
    handle(
      new Request(`https://x${path}`, {
        method: 'POST',
        headers: { 'x-observatory': '1', 'content-type': 'application/json' },
        body: JSON.stringify(body),
      }),
    );
  return { events, handle, post };
}

describe('withInboxRoutes', () => {
  it('reads the inbox, and from GitHub anew when asked to', async () => {
    const { events, handle } = setUp();

    assert.deepEqual(await (await handle(new Request('https://x/api/inbox'))).json(), REPORT);
    await handle(new Request('https://x/api/inbox?fresh=1'));

    assert.deepEqual(events, ['read', 'forget', 'read']);
  });

  it('marks one thread read, then drops the cached inbox', async () => {
    const { events, post } = setUp();

    const response = await post('/api/inbox/read', { id: '26190275086' });

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { id: '26190275086' });
    assert.deepEqual(events, ['mark 26190275086', 'forget']);
  });

  it('marks all read up to the time given, to the second', async () => {
    const { events, post } = setUp();

    const response = await post('/api/inbox/read-all', { before: '2026-10-08T12:00:00.123Z' });

    assert.deepEqual(await response.json(), { before: '2026-10-08T12:00:00Z' });
    assert.deepEqual(events, ['mark all 2026-10-08T12:00:00Z', 'forget']);
  });

  it('drops the cached inbox even when GitHub refuses the mark', async (context) => {
    context.mock.method(console, 'error', () => undefined);
    const { events, post } = setUp({
      markThreadRead: async () => {
        throw new Error('GitHub: HTTP 403');
      },
    });

    assert.equal((await post('/api/inbox/read', { id: '1' })).status, 500);
    assert.deepEqual(events, ['forget']);
  });

  it('refuses a bad id or time before GitHub is asked', async () => {
    const { events, post } = setUp();

    assert.equal((await post('/api/inbox/read', { id: '../user' })).status, 400);
    assert.equal((await post('/api/inbox/read-all', { before: 'soon' })).status, 400);
    assert.deepEqual(events, []);
  });

  it('refuses a mark without the page’s own header', async () => {
    const { events, handle } = setUp();

    const response = await handle(
      new Request('https://x/api/inbox/read', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: '1' }),
      }),
    );

    assert.equal(response.status, 403);
    assert.deepEqual(events, []);
  });
});

describe('threadIdFrom and instantFrom', () => {
  it('take only digits for an id, and only a real time', () => {
    assert.equal(threadIdFrom(42), '42');
    assert.throws(() => threadIdFrom('1/2'));
    assert.throws(() => threadIdFrom('1'.repeat(21)));
    assert.equal(instantFrom('2026-10-08T12:00:00Z'), '2026-10-08T12:00:00Z');
    assert.throws(() => instantFrom(1_700_000_000));
  });
});
