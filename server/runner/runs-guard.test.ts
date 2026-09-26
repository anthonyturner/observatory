import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { json } from '../http/api-handler.ts';
import { guardRuns } from './runs-guard.ts';

const handle = guardRuns(async () => json(200, { ok: true }));

const ask = (path: string, method: string, headers: Record<string, string>) =>
  handle(new Request(`http://localhost:4319${path}`, { method, headers }));

describe('guardRuns', () => {
  it('lets this machine’s page read, start and cancel runs, from any loopback port', async () => {
    const host = { host: 'localhost:4319' };

    assert.equal((await ask('/api/runs', 'GET', host)).status, 200);
    for (const origin of ['http://localhost:4200', 'http://127.0.0.1:4319', 'http://[::1]:4200']) {
      assert.equal((await ask('/api/runs', 'POST', { ...host, origin })).status, 200, origin);
    }
    assert.equal(
      (
        await ask('/api/runs', 'DELETE', {
          host: '127.0.0.1:4319',
          origin: 'http://localhost:4200',
        })
      ).status,
      200,
    );
  });

  it('refuses a foreign Host, as a DNS-rebound page would send', async () => {
    const response = await ask('/api/runs', 'GET', { host: 'evil.example:4319' });

    assert.equal(response.status, 403);
  });

  it('refuses a foreign Origin, and a write with no Origin at all', async () => {
    const host = { host: 'localhost:4319' };

    assert.equal(
      (await ask('/api/runs', 'GET', { ...host, origin: 'https://evil.example' })).status,
      403,
    );
    assert.equal(
      (await ask('/api/runs', 'POST', { ...host, origin: 'https://evil.example' })).status,
      403,
    );
    assert.equal((await ask('/api/runs', 'POST', host)).status, 403);
    assert.equal((await ask('/api/runs', 'DELETE', { ...host, origin: 'null' })).status, 403);
  });

  it('leaves every other route to the handler', async () => {
    assert.equal((await ask('/api/triage', 'POST', { host: 'evil.example' })).status, 200);
  });
});
