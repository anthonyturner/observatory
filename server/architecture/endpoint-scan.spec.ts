import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { scanSource } from './source-scan.ts';

const endpointsOf = (text: string) => scanSource('routes.ts', text).endpoints;

describe('endpoints: route tables', () => {
  it('reads each entry of a table, with its key as a literal or a constant', () => {
    const found = endpointsOf(`
      export const table = {
        get: {
          '/api/usage': () => reads.usage(),
          [QUEUE_PATH]: async (query) => withTriage(await reads.queue(query)),
        },
        post: { '/api/triage': (body) => recordTriage(body) },
        delete: { '/api/runs'() { return stop(); } },
      };
    `);
    assert.deepEqual(
      found.map(({ method, path, handlers }) => [method, path, handlers]),
      [
        ['GET', ['/api/usage'], ['reads']],
        ['GET', [{ name: 'QUEUE_PATH' }], ['query', 'reads', 'withTriage']],
        ['POST', ['/api/triage'], ['body', 'recordTriage']],
        ['DELETE', ['/api/runs'], ['stop']],
      ],
    );
  });

  it('skips a spread and an entry whose key is not text', () => {
    assert.deepEqual(endpointsOf(`const t = { get: { ...table.get, 7: handler } };`), []);
  });
});

describe('endpoints: routers', () => {
  it('reads a verb called on a router with a path and a handler', () => {
    const found = endpointsOf(`
      app.get('/health', (req, res) => res.send('ok'));
      apiRouter.post('/queue', auth, createQueue);
    `);
    assert.deepEqual(
      found.map(({ method, path, handlers }) => [method, path, handlers]),
      [
        ['GET', ['/health'], ['req', 'res']],
        ['POST', ['/queue'], ['auth', 'createQueue']],
      ],
    );
  });

  it('leaves a get with no handler, or on another object, alone', () => {
    assert.deepEqual(endpointsOf(`app.get('/x'); cache.get('/x', fallback);`), []);
  });
});
