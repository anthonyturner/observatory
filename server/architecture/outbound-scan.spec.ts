import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { scanSource } from './source-scan.ts';

const outboundOf = (text: string) =>
  scanSource('a.ts', text).outbound.map(({ via, method, target, owner }) => ({
    via,
    method,
    target,
    owner,
  }));

describe('outbound calls: HTTP', () => {
  it('reads each HttpClient verb on an injected client, from a field or a parameter', () => {
    const found = outboundOf(`
      @Injectable() export class Feed {
        private readonly http = inject(HttpClient);
        load() { return this.http.get<Report>('/api/queue'); }
        save() { return this.http.post(\`/api/queue/\${id}\`, body); }
      }
      export function read(client: HttpClient) { return client.delete('/api/runs'); }
    `);
    assert.deepEqual(found, [
      { via: 'http', method: 'GET', target: ['/api/queue'], owner: 'Feed' },
      { via: 'http', method: 'POST', target: ['/api/queue/', { name: 'id' }, ''], owner: 'Feed' },
      { via: 'http', method: 'DELETE', target: ['/api/runs'], owner: null },
    ]);
  });

  it('leaves a get on anything that is not an HttpClient alone', () => {
    assert.deepEqual(outboundOf(`const x = cache.get('/api/queue'); map.get('/x');`), []);
  });

  it('reads fetch, its method option, and an EventSource', () => {
    const found = outboundOf(`
      fetch('/api/a');
      fetch('/api/b', { method: 'post' });
      fetch('/api/c', { method: verb });
      new EventSource('/api/stream');
    `);
    assert.deepEqual(
      found.map(({ method, target }) => [method, target]),
      [
        ['GET', ['/api/a']],
        ['POST', ['/api/b']],
        [null, ['/api/c']],
        ['GET', ['/api/stream']],
      ],
    );
  });

  it('follows a name that holds fetch, such as an injected one', () => {
    const found = outboundOf(`
      export function open(config: Config) {
        const { token, fetch: send = fetch } = config;
        return send('https://api.github.com/user');
      }
      export const read = (fetcher: typeof fetch) => fetcher('https://example.com/x');
      export const ask = (source: Source) => source.fetch('https://example.com/y');
    `);
    assert.deepEqual(
      found.map(({ target }) => target),
      [['https://api.github.com/user'], ['https://example.com/x'], ['https://example.com/y']],
    );
  });

  it('reads the http module’s get and request', () => {
    const found = outboundOf(`
      import https from 'node:https';
      https.get('https://example.com/a');
      https.request('https://example.com/b');
    `);
    assert.deepEqual(
      found.map(({ method }) => method),
      ['GET', null],
    );
  });
});

describe('outbound calls: processes', () => {
  it('reads a program started through child_process, aliased, promisified or off the module', () => {
    const found = outboundOf(`
      import { execFile as run, spawn } from 'node:child_process';
      import * as cp from 'node:child_process';
      import { promisify } from 'node:util';
      const exec = promisify(run);
      export const a = () => run('git', ['log']);
      export const b = () => spawn(PROGRAM, []);
      export const c = () => cp.execFileSync('gh', []);
      export const d = () => exec('powershell', []);
    `);
    assert.deepEqual(
      found.map(({ via, target }) => [via, target]),
      [
        ['process', ['git']],
        ['process', [{ name: 'PROGRAM' }]],
        ['process', ['gh']],
        ['process', ['powershell']],
      ],
    );
  });

  it('takes the first word of a command line as the program', () => {
    const found = outboundOf(`
      import { execSync } from 'child_process';
      execSync('npm run build --silent');
    `);
    assert.deepEqual(found[0]?.target, ['npm']);
  });

  it('ignores a call named spawn that child_process did not provide', () => {
    assert.deepEqual(outboundOf(`spawn('git');`), []);
  });
});
