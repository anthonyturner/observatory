import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { architectureMap } from './architecture-map.ts';
import type { ArchitectureMap, ArchitectureRuntime } from './architecture-types.ts';
import { mapProblems } from './map-problems.ts';
import { scanSource } from './source-scan.ts';

const RUNTIMES: ArchitectureRuntime[] = [
  { id: 'browser', label: 'Browser app', kind: 'browser', root: 'src/app' },
  { id: 'server', label: 'API server', kind: 'server', root: 'server' },
];

const SERVER_ROUTES = `
  export const routes = {
    get: { '/api/queue': () => 1, '/api/queue/:id': () => 2, '/api/queue/recent': () => 3 },
    post: { '/api/queue': () => 4 },
  };
`;

const mapOf = (sources: Readonly<Record<string, string>>): ArchitectureMap => {
  const map = architectureMap({
    project: 'fixture',
    scannedAt: '',
    windows: [],
    runtimes: RUNTIMES,
    entryFiles: [],
    files: Object.entries(sources).map(([file, text]) => ({ ...scanSource(file, text), file })),
    aliases: [],
    graph: { imports: [], cycles: [], orphans: [] },
    churn: new Map(),
    churnDays: 0,
  });
  assert.deepEqual(mapProblems(map), []);
  return map;
};

const linksOf = (map: ArchitectureMap, kind: string) =>
  map.edges.filter((edge) => edge.kind === kind).map(({ from, to }) => `${from} > ${to}`);

const clientFile = (body: string) => `
  @Injectable() export class Feed {
    private readonly http = inject(HttpClient);
    run(id: number, base: string) { ${body} }
  }
`;

describe('networkLinks: requests', () => {
  const requests = (body: string) =>
    linksOf(
      mapOf({ 'server/routes.ts': SERVER_ROUTES, 'src/app/feed.ts': clientFile(body) }),
      'requests',
    ).map((link) => link.replace('src/app/feed.ts#Feed > route:', ''));

  it('matches a request to the route of its method and path, ignoring a query string', () => {
    assert.deepEqual(requests(`this.http.get('/api/queue?repo=a');`), ['GET /api/queue']);
    assert.deepEqual(requests(`this.http.post('/api/queue', {});`), ['POST /api/queue']);
  });

  it('lets a route’s parameter take any segment, and ignores a trailing slash', () => {
    assert.deepEqual(requests(`this.http.get('/api/queue/7/');`), ['GET /api/queue/:id']);
    assert.deepEqual(requests('this.http.get(`/api/queue/${id}`);'), ['GET /api/queue/:id']);
  });

  it('prefers the route nearest the request: the same path, then a parameter, then a fixed segment', () => {
    assert.deepEqual(requests(`this.http.get('/api/queue/recent');`), ['GET /api/queue/recent']);
    assert.deepEqual(requests('this.http.get(`/api/queue/${id}`);'), ['GET /api/queue/:id']);
    assert.deepEqual(requests('this.http.get(`/api/${kind}/recent`);'), [
      'GET /api/queue/:id',
      'GET /api/queue/recent',
    ]);
  });

  it('matches nothing when the path starts with something unknown, or no route has its method', () => {
    assert.deepEqual(requests('this.http.get(`${base}/queue`);'), []);
    assert.deepEqual(requests(`this.http.delete('/api/queue');`), []);
  });
});

describe('networkLinks: routes and outside services', () => {
  it('registers one route for a path two files serve, with the code behind each', () => {
    const map = mapOf({
      'server/a.ts': `export const a = { get: { '/api/x': () => helperA() } }; import { helperA } from './helper-a.ts';`,
      'server/b.ts': `export const b = { get: { '/api/x': () => helperB() } }; import { helperB } from './helper-b.ts';`,
      'server/helper-a.ts': `export const helperA = () => 1;`,
      'server/helper-b.ts': `export const helperB = () => 2;`,
    });
    assert.equal(map.nodes.filter(({ kind }) => kind === 'route').length, 1);
    assert.deepEqual(linksOf(map, 'handles'), [
      'route:GET /api/x > server/helper-a.ts',
      'route:GET /api/x > server/helper-b.ts',
    ]);
  });

  it('links a route to its own file when the handler uses nothing imported', () => {
    const map = mapOf({ 'server/a.ts': `export const a = { get: { '/api/x': () => 1 } };` });
    assert.deepEqual(linksOf(map, 'handles'), ['route:GET /api/x > server/a.ts']);
  });

  it('names a service by the host of an absolute URL, with a constant or an unknown tail', () => {
    const map = mapOf({
      'server/a.ts': `
        const ROOT = 'https://API.example.com:8443';
        export const one = () => fetch(\`\${ROOT}/v1/\${path}\`);
        export const two = () => fetch(\`\${ROOT}\${path}\`);
        export const three = () => fetch(\`https://\${region}.example.com/x\`);
        export const four = () => fetch(\`http://localhost:3000/x\`);
      `,
    });
    assert.deepEqual(
      map.nodes.filter(({ kind }) => kind === 'external').map(({ id }) => id),
      ['external:api.example.com:8443', 'external:localhost:3000'],
    );
  });

  it('counts an import of a network package as reaching its service', () => {
    const map = mapOf({
      'server/mail.ts': `import { ImapFlow } from 'imapflow'; export const m = ImapFlow;`,
    });
    assert.deepEqual(linksOf(map, 'reaches'), ['server/mail.ts > external:imap-server']);
  });

  it('adds no outside runtime when nothing reaches one', () => {
    const map = mapOf({ 'server/a.ts': 'export const a = 1;' });
    assert.deepEqual(
      map.runtimes.map(({ id }) => id),
      ['browser', 'server'],
    );
  });
});
