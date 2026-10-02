import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createApiHandler } from '../http/api-handler.ts';
import { guardLoopback } from '../http/loopback-guard.ts';
import { MAIL_PATH, MAIL_PATHS, withMailRoutes } from './mail-routes.ts';
import type { Mailboxes } from './mailboxes.ts';
import type { MailAccount, MailboxReport } from './mail-types.ts';

/** Mailboxes that answer "off" for every account and record what they were asked. */
function recordingMailboxes() {
  const calls: string[] = [];
  const box: Mailboxes = {
    read: async (account: MailAccount): Promise<MailboxReport> => {
      calls.push(`read ${account}`);
      return { account, state: 'off', settings: [] };
    },
    forget: (account) => {
      calls.push(`forget ${account}`);
    },
  };
  return { box, calls };
}

const LOCAL = 'http://127.0.0.1:4319';
const OWN_PAGE = { 'x-observatory': '1', host: '127.0.0.1:4319' };

function site() {
  const { box, calls } = recordingMailboxes();
  const handle = guardLoopback(
    createApiHandler(withMailRoutes({ get: {}, post: {} }, box)),
    MAIL_PATHS,
  );
  const get = (query: string, headers: Record<string, string> = OWN_PAGE) =>
    handle(new Request(`${LOCAL}${MAIL_PATH}${query}`, { headers }));
  return { get, calls };
}

describe('withMailRoutes', () => {
  it('answers one account at a time, from the cache', async () => {
    const { get, calls } = site();

    const response = await get('?account=gmail');

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { account: 'gmail', state: 'off', settings: [] });
    assert.deepEqual(calls, ['read gmail']);
  });

  it('reads the inbox again on Refresh', async () => {
    const { get, calls } = site();

    await get('?account=icloud&refresh=1');

    assert.deepEqual(calls, ['forget icloud', 'read icloud']);
  });

  it('refuses an account it does not know', async () => {
    const { get, calls } = site();

    assert.equal((await get('?account=outlook')).status, 400);
    assert.equal((await get('')).status, 400);
    assert.deepEqual(calls, []);
  });

  it('needs the x-observatory header, so another site’s image cannot set off a sign-in', async () => {
    const { get, calls } = site();

    assert.equal((await get('?account=icloud', { host: '127.0.0.1:4319' })).status, 403);
    assert.deepEqual(calls, []);
  });

  it('answers only this machine’s own page', async () => {
    const { get, calls } = site();

    assert.equal(
      (await get('?account=icloud', { ...OWN_PAGE, host: 'rebound.example' })).status,
      403,
    );
    assert.equal(
      (await get('?account=icloud', { ...OWN_PAGE, origin: 'https://evil.example' })).status,
      403,
    );
    assert.deepEqual(calls, []);
  });
});
