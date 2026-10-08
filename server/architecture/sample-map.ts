import type {
  ArchitectureEdge,
  ArchitectureMap,
  ArchitectureNode,
  EdgeKind,
  EdgeMark,
} from './architecture-types.ts';

/** A node with every field the sample does not care about at its quiet default. */
const node = (
  fields: Partial<ArchitectureNode> & Pick<ArchitectureNode, 'id' | 'name' | 'kind' | 'area'>,
): ArchitectureNode => ({
  file: fields.id.split('#')[0] ?? '',
  group: '',
  providedIn: null,
  windows: [],
  parent: null,
  members: [],
  endpoint: null,
  loc: 0,
  metrics: { fanIn: 0, fanOut: 0, churn: 0 },
  marks: [],
  ...fields,
});

const edge = (
  from: string,
  to: string,
  kind: EdgeKind,
  marks: readonly EdgeMark[] = [],
): ArchitectureEdge => ({
  from,
  to,
  kind,
  how: kind === 'injects' ? 'inject' : null,
  members: [],
  marks,
});

const QUEUE_PAGE = 'src/app/features/queue/queue-page.ts#QueuePage';
const QUEUE_ROW = 'src/app/features/queue/queue-row.ts#QueueRow';
const QUEUE_STORE = 'src/app/core/queue/queue-store.ts#QueueStore';
const QUEUE_FEED = 'src/app/core/queue/queue-feed.ts#QueueFeed';
const QUEUE_URL = 'src/app/core/queue/queue-url.ts#QUEUE_URL';
const BASE_FEED = 'src/app/core/feed/base-feed.ts#BaseFeed';
const QUEUE_PROVIDERS = 'src/app/core/queue/queue-providers.ts#QUEUE_PROVIDERS';
const QUEUE_GUARD = 'src/app/core/queue/queue-guard.ts#queueGuard';
const QUEUE_HANDLER = 'src/app/core/queue/queue-handler.ts#QueueKeyHandler';
const OLD_BANNER = 'src/app/features/queue/old-banner.ts#OldBanner';
const QUEUE_ROUTE = 'route:GET /api/queue';
const QUEUE_ROUTES = 'server/queue/queue-routes.ts';
const GITHUB_CLIENT = 'server/github/github-client.ts';
const RUNNER = 'server/runner/runner.ts';
const GITHUB = 'external:api.github.com';
const CLAUDE = 'external:claude';

/**
 * A small map of a made-up Observatory that uses every runtime, node kind, edge
 * kind and mark, so a view can be built and tested before the scanner fills them.
 */
export const SAMPLE_MAP: ArchitectureMap = {
  schema: 3,
  project: 'observatory-sample',
  scannedAt: '2026-10-08T00:00:00.000Z',
  churnDays: 90,
  runtimes: [
    { id: 'browser', label: 'Browser app', kind: 'browser', root: 'src/app' },
    { id: 'server', label: 'API server', kind: 'server', root: 'server' },
    { id: 'web', label: 'Outside services', kind: 'web-service', root: '' },
    { id: 'programs', label: 'Spawned programs', kind: 'program', root: '' },
  ],
  areas: [
    {
      id: 'browser:features/queue',
      label: 'Queue',
      runtime: 'browser',
      folder: 'src/app/features/queue',
    },
    {
      id: 'browser:core/queue',
      label: 'Queue core',
      runtime: 'browser',
      folder: 'src/app/core/queue',
    },
    { id: 'browser:core/feed', label: 'Feed', runtime: 'browser', folder: 'src/app/core/feed' },
    { id: 'server:queue', label: 'Queue API', runtime: 'server', folder: 'server/queue' },
    { id: 'server:github', label: 'GitHub', runtime: 'server', folder: 'server/github' },
    { id: 'server:runner', label: 'Runner', runtime: 'server', folder: 'server/runner' },
    { id: 'web', label: 'Outside services', runtime: 'web', folder: '' },
    { id: 'programs', label: 'Spawned programs', runtime: 'programs', folder: '' },
  ],
  windows: [],
  nodes: [
    node({
      id: QUEUE_PAGE,
      name: 'QueuePage',
      kind: 'component',
      area: 'browser:features/queue',
      members: [
        { name: 'items', kind: 'signal', visibility: 'protected' },
        { name: 'focus', kind: 'method', visibility: 'public' },
        { name: 'compact', kind: 'input', visibility: 'public' },
      ],
      loc: 120,
      metrics: { fanIn: 1, fanOut: 2, churn: 14 },
      marks: ['hot'],
    }),
    node({
      id: QUEUE_ROW,
      name: 'QueueRow',
      kind: 'component',
      area: 'browser:features/queue',
      parent: QUEUE_PAGE,
      members: [{ name: 'opened', kind: 'output', visibility: 'public' }],
      loc: 60,
      metrics: { fanIn: 1, fanOut: 0, churn: 3 },
    }),
    node({
      id: OLD_BANNER,
      name: 'OldBanner',
      kind: 'component',
      area: 'browser:features/queue',
      loc: 25,
      marks: ['unused'],
    }),
    node({
      id: QUEUE_STORE,
      name: 'QueueStore',
      kind: 'store',
      area: 'browser:core/queue',
      providedIn: 'root',
      members: [
        { name: 'state', kind: 'signal', visibility: 'private' },
        { name: 'select', kind: 'method', visibility: 'public' },
      ],
      loc: 90,
      metrics: { fanIn: 4, fanOut: 1, churn: 9 },
      marks: ['hub', 'cycle'],
    }),
    node({
      id: QUEUE_FEED,
      name: 'QueueFeed',
      kind: 'service',
      area: 'browser:core/queue',
      providedIn: 'root',
      members: [
        { name: 'items$', kind: 'property', visibility: 'public' },
        { name: 'url', kind: 'accessor', visibility: 'private' },
      ],
      loc: 70,
      metrics: { fanIn: 1, fanOut: 4, churn: 4 },
      marks: ['cycle', 'boundary'],
    }),
    node({
      id: QUEUE_URL,
      name: 'QUEUE_URL',
      kind: 'token',
      area: 'browser:core/queue',
      providedIn: 'root',
      loc: 6,
      metrics: { fanIn: 1, fanOut: 0, churn: 1 },
    }),
    node({
      id: BASE_FEED,
      name: 'BaseFeed',
      kind: 'service',
      area: 'browser:core/feed',
      loc: 40,
      metrics: { fanIn: 1, fanOut: 0, churn: 0 },
    }),
    node({
      id: QUEUE_PROVIDERS,
      name: 'QUEUE_PROVIDERS',
      kind: 'providers',
      area: 'browser:core/queue',
      loc: 12,
      metrics: { fanIn: 0, fanOut: 1, churn: 1 },
    }),
    node({
      id: QUEUE_GUARD,
      name: 'queueGuard',
      kind: 'function',
      area: 'browser:core/queue',
      loc: 15,
      metrics: { fanIn: 0, fanOut: 1, churn: 2 },
    }),
    node({
      id: QUEUE_HANDLER,
      name: 'QueueKeyHandler',
      kind: 'handler',
      area: 'browser:core/queue',
      providedIn: 'root',
      loc: 30,
      metrics: { fanIn: 0, fanOut: 1, churn: 1 },
    }),
    node({
      id: QUEUE_ROUTE,
      name: 'GET /api/queue',
      kind: 'route',
      file: QUEUE_ROUTES,
      area: 'server:queue',
      endpoint: { method: 'GET', path: '/api/queue' },
      loc: 0,
    }),
    node({
      id: QUEUE_ROUTES,
      name: 'queue-routes',
      kind: 'module',
      area: 'server:queue',
      members: [{ name: 'withQueueRoutes', kind: 'export', visibility: 'public' }],
      loc: 80,
      metrics: { fanIn: 0, fanOut: 2, churn: 6 },
    }),
    node({
      id: GITHUB_CLIENT,
      name: 'github-client',
      kind: 'module',
      area: 'server:github',
      members: [{ name: 'githubRequest', kind: 'export', visibility: 'public' }],
      loc: 150,
      metrics: { fanIn: 2, fanOut: 0, churn: 11 },
      marks: ['hot', 'boundary'],
    }),
    node({
      id: RUNNER,
      name: 'runner',
      kind: 'module',
      area: 'server:runner',
      members: [{ name: 'runClaude', kind: 'export', visibility: 'public' }],
      loc: 110,
      metrics: { fanIn: 1, fanOut: 0, churn: 2 },
    }),
    node({ id: GITHUB, name: 'api.github.com', kind: 'external', file: '', area: 'web' }),
    node({ id: CLAUDE, name: 'claude', kind: 'external', file: '', area: 'programs' }),
  ],
  edges: [
    edge(QUEUE_PAGE, QUEUE_STORE, 'injects'),
    edge(QUEUE_PAGE, QUEUE_ROW, 'uses'),
    edge(QUEUE_STORE, QUEUE_FEED, 'injects', ['cycle']),
    edge(QUEUE_FEED, QUEUE_STORE, 'calls', ['cycle']),
    edge(QUEUE_FEED, QUEUE_URL, 'injects'),
    edge(QUEUE_FEED, BASE_FEED, 'extends'),
    edge(QUEUE_PROVIDERS, QUEUE_STORE, 'provides'),
    edge(QUEUE_GUARD, QUEUE_STORE, 'injects'),
    edge(QUEUE_HANDLER, QUEUE_PAGE, 'imports'),
    edge(QUEUE_FEED, GITHUB_CLIENT, 'imports', ['boundary']),
    edge(QUEUE_FEED, QUEUE_ROUTE, 'requests'),
    edge(QUEUE_ROUTE, QUEUE_ROUTES, 'handles'),
    edge(QUEUE_ROUTES, GITHUB_CLIENT, 'calls'),
    edge(QUEUE_ROUTES, RUNNER, 'imports'),
    edge(GITHUB_CLIENT, GITHUB, 'reaches'),
    edge(RUNNER, CLAUDE, 'spawns'),
  ],
  cycles: [[QUEUE_STORE, QUEUE_FEED]],
};
