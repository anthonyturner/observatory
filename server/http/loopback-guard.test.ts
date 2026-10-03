import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { json } from './api-handler.ts';
import { guardLoopback, hasLoopbackHost, isLoopbackOrigin } from './loopback-guard.ts';

const handle = guardLoopback(async () => json(200, { ok: true }));

const ask = (path: string, method: string, headers: Record<string, string>) =>
  handle(new Request(`http://localhost:4319${path}`, { method, headers }));

describe('guardLoopback', () => {
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

  it('answers a request the way `ng serve` proxies it: the page’s own Host and Origin', async () => {
    const page = { host: 'localhost:4200', origin: 'http://localhost:4200' };

    assert.equal((await ask('/api/edit', 'POST', page)).status, 200);
    assert.equal((await ask('/api/edit/clear', 'POST', page)).status, 200);
    assert.equal((await ask('/api/projects', 'GET', { host: 'localhost:4200' })).status, 200);
  });

  it('refuses a foreign Host on every route, as a DNS-rebound page would send', async () => {
    const rebound = { host: 'evil.example:4319', origin: 'http://evil.example:4319' };

    assert.equal((await ask('/api/edit', 'POST', rebound)).status, 403);
    assert.equal((await ask('/api/projects', 'GET', { host: 'evil.example:4319' })).status, 403);
    assert.equal((await ask('/api/usage', 'GET', { host: 'evil.example' })).status, 403);
    assert.equal((await ask('/api/runs', 'GET', { host: 'evil.example:4319' })).status, 403);
  });

  it('refuses a write on every route with a foreign Origin, or with no Origin at all', async () => {
    const host = { host: 'localhost:4319' };

    for (const path of ['/api/edit', '/api/edit/clear', '/api/triage', '/api/runs']) {
      assert.equal((await ask(path, 'POST', host)).status, 403, path);
      assert.equal(
        (await ask(path, 'POST', { ...host, origin: 'https://evil.example' })).status,
        403,
        path,
      );
    }
    assert.equal((await ask('/api/runs', 'DELETE', host)).status, 403);
    assert.equal((await ask('/api/runs', 'DELETE', { ...host, origin: 'null' })).status, 403);
  });

  it('refuses a read sent from another site’s page', async () => {
    const response = await ask('/api/runs', 'GET', {
      host: 'localhost:4319',
      origin: 'https://evil.example',
    });

    assert.equal(response.status, 403);
  });
});

describe('hasLoopbackHost', () => {
  const withHost = (host: string) => new Request('http://localhost/', { headers: { host } });

  it('accepts this machine by any of its names, on any port', () => {
    for (const host of ['localhost', 'LOCALHOST:4200', '127.0.0.1:4319', '[::1]:4319']) {
      assert.equal(hasLoopbackHost(withHost(host)), true, host);
    }
  });

  it('refuses any other name, and a Host that is not a host at all', () => {
    for (const host of ['evil.example', 'localhost.evil.example', '127.0.0.2', 'a b']) {
      assert.equal(hasLoopbackHost(withHost(host)), false, host);
    }
  });
});

describe('isLoopbackOrigin', () => {
  it('accepts a page served from this machine, and nothing else', () => {
    assert.equal(isLoopbackOrigin('http://localhost:4200'), true);
    assert.equal(isLoopbackOrigin('https://evil.example'), false);
    assert.equal(isLoopbackOrigin('null'), false);
  });
});
