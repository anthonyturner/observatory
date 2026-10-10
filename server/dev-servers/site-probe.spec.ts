import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { describe, it } from 'node:test';
import { freeLoopbackPort } from './dev-port.ts';
import { answersHttp } from './site-probe.ts';

/** A throwaway local site that answers every request with `status`. */
function serveWith(status: number): Promise<{ url: string; close: () => Promise<void> }> {
  return new Promise((resolve) => {
    const server = createServer((_request, response) => response.writeHead(status).end('hi'));
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address !== null ? address.port : 0;
      resolve({
        url: `http://127.0.0.1:${port}/`,
        close: () =>
          new Promise((done) => {
            server.closeAllConnections();
            server.close(() => done());
          }),
      });
    });
  });
}

describe('answersHttp', () => {
  it('is true for a site that answers, whatever its status, as a server still building does', async () => {
    for (const status of [200, 404, 500]) {
      const site = await serveWith(status);
      assert.equal(await answersHttp(site.url), true, String(status));
      await site.close();
    }
  });

  it('is false where nothing listens', async () => {
    const port = await freeLoopbackPort();

    assert.equal(await answersHttp(`http://127.0.0.1:${port}/`), false);
  });

  it('is false for an address it cannot make a request to', async () => {
    assert.equal(await answersHttp('http://'), false);
  });
});
