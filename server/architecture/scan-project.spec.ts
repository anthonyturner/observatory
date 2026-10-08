import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';
import type { ArchitectureMap } from './architecture-types.ts';
import { commitOn, fixtureProject, initGit, write } from './fixture-project.testing.ts';
import { mapProblems } from './map-problems.ts';
import { scanProject } from './scan-project.ts';

const FILES: Readonly<Record<string, string>> = {
  'angular.json': JSON.stringify({
    projects: {
      web: {
        projectType: 'application',
        sourceRoot: 'src',
        architect: { build: { options: { browser: 'src/main.ts' } } },
      },
    },
  }),
  'package.json': JSON.stringify({ scripts: { api: 'node server/main.ts' } }),
  'src/main.ts': `
    import { bootstrapApplication } from '@angular/platform-browser';
    import { App } from './app/app';
    bootstrapApplication(App, {});
  `,
  'src/app/app.ts': `
    import { Component } from '@angular/core';
    @Component({ selector: 'app-root', template: '<app-queue-panel></app-queue-panel>' })
    export class App {}
  `,
  'src/app/features/queue/queue-panel.ts': `
    import { Component, inject, input } from '@angular/core';
    import { QueueFeed } from '../../core/queue/queue-feed';
    @Component({ selector: 'app-queue-panel', template: '' })
    export class QueuePanel {
      readonly feed = inject(QueueFeed);
      readonly repo = input('');
    }
  `,
  'src/app/features/mail/mail.ts': `
    @Component({ selector: 'app-mail', template: '' }) export class Mail {}
  `,
  'src/app/features/sky/sky.ts': `
    @Component({ selector: 'app-sky', template: '' }) export class Sky {}
  `,
  'src/app/core/queue/queue-feed.ts': `
    @Injectable({ providedIn: 'root' })
    export class QueueFeed {
      private readonly http = inject(HttpClient);
      load() { return this.http.get('/api/queue'); }
      save(id: number) { return this.http.post(\`/api/queue/\${id}\`, {}); }
    }
  `,
  'src/app/core/queue/queue-view.ts': `
    export const load = () => fetch('https://api.example.com/v1/queue');
  `,
  'src/app/core/mail/mail-feed.ts': `
    @Injectable({ providedIn: 'root' }) export class MailFeed {}
  `,
  'src/app/core/sky/sky-feed.ts': `
    @Injectable({ providedIn: 'root' }) export class SkyFeed {}
  `,
  'server/main.ts': `
    import { routes } from './queue/queue-routes.ts';
    console.log(routes);
  `,
  'server/queue/paths.ts': `
    export const QUEUE_PATH = '/api/queue';
    export const ITEM_PATH = '/api/queue/:id';
  `,
  'server/queue/read-queue.ts': `
    import { execFile } from 'node:child_process';
    export function readQueue(): string {
      execFile('git', ['status']);
      return '';
    }
  `,
  'server/queue/queue-routes.ts': `
    import { ITEM_PATH, QUEUE_PATH } from './paths.ts';
    import { readQueue } from './read-queue.ts';
    export const routes = {
      get: { [QUEUE_PATH]: () => readQueue() },
      post: { [ITEM_PATH]: () => readQueue() },
    };
  `,
  'server/lib/a.ts': `import { b } from './b.ts'; export const a = (): number => b();`,
  'server/lib/b.ts': `import { a } from './a.ts'; export const b = (): number => a();`,
};

const linksOf = (map: ArchitectureMap) =>
  map.edges.map(({ from, to, kind }) => `${from} ${kind} ${to}`);

const withoutTime = (map: ArchitectureMap) => ({ ...map, scannedAt: '' });

describe('scanProject: a fixture project with git history', () => {
  let map: ArchitectureMap;
  let root: string;

  before(async () => {
    root = fixtureProject(FILES);
    initGit(root);
    commitOn(root, 'first', '2020-06-01T12:00:00Z');
    write(root, 'server/queue/read-queue.ts', `${FILES['server/queue/read-queue.ts']}\n`);
    commitOn(root, 'second', '2020-06-10T12:00:00Z');
    map = await scanProject(root);
  });

  it('keeps every rule the contract states', () => {
    assert.deepEqual(mapProblems(map), []);
  });

  it('finds the browser and server runtimes, and the outside ones that are reached', () => {
    assert.deepEqual(
      map.runtimes.map(({ id }) => id),
      ['browser', 'server', 'web-service', 'program'],
    );
  });

  it('divides each runtime into areas by folder', () => {
    assert.deepEqual(
      map.areas.map(({ id }) => id),
      [
        'browser:.',
        'browser:core/mail',
        'browser:core/queue',
        'browser:core/sky',
        'browser:features/mail',
        'browser:features/queue',
        'browser:features/sky',
        'program',
        'server:.',
        'server:lib',
        'server:queue',
        'web-service',
      ],
    );
  });

  it('makes a route of each endpoint, resolving the paths it names through imports', () => {
    assert.deepEqual(
      map.nodes.filter(({ kind }) => kind === 'route').map(({ id, endpoint }) => [id, endpoint]),
      [
        ['route:GET /api/queue', { method: 'GET', path: '/api/queue' }],
        ['route:POST /api/queue/:id', { method: 'POST', path: '/api/queue/:id' }],
      ],
    );
  });

  it('links routes to their code, requests to routes, and calls to the outside', () => {
    const links = linksOf(map);
    assert.ok(links.includes('route:GET /api/queue handles server/queue/read-queue.ts'));
    assert.ok(
      links.includes('src/app/core/queue/queue-feed.ts#QueueFeed requests route:GET /api/queue'),
    );
    assert.ok(
      links.includes(
        'src/app/core/queue/queue-feed.ts#QueueFeed requests route:POST /api/queue/:id',
      ),
    );
    assert.ok(links.includes('src/app/core/queue/queue-view.ts reaches external:api.example.com'));
    assert.ok(links.includes('server/queue/read-queue.ts spawns external:git'));
  });

  it('adds an imports edge only where nothing richer joins two files', () => {
    const links = linksOf(map);
    assert.ok(links.includes('server/main.ts imports server/queue/queue-routes.ts'));
    assert.ok(
      links.some((link) => link.includes('queue-panel.ts#QueuePanel injects')),
      'the injection is kept',
    );
    assert.ok(
      !links.some((link) => link.includes('queue-panel.ts#QueuePanel imports')),
      'and explains the import',
    );
  });

  it('lists an import cycle by its nodes and marks the nodes and edges on it', () => {
    assert.deepEqual(map.cycles, [['server/lib/a.ts', 'server/lib/b.ts']]);
    const marked = map.nodes.filter(({ marks }) => marks.includes('cycle')).map(({ id }) => id);
    assert.deepEqual(marked, ['server/lib/a.ts', 'server/lib/b.ts']);
    assert.equal(map.edges.filter(({ marks }) => marks.includes('cycle')).length, 2);
  });

  it('names a parent component, the members it declares, and a file’s size and churn', () => {
    const panel = map.nodes.find(({ name }) => name === 'QueuePanel');
    assert.equal(panel?.parent, 'src/app/app.ts#App');
    assert.deepEqual(
      panel?.members.map(({ name, kind }) => [name, kind]),
      [
        ['feed', 'property'],
        ['repo', 'input'],
      ],
    );
    const read = map.nodes.find(({ id }) => id === 'server/queue/read-queue.ts');
    assert.deepEqual([read?.loc, read?.metrics.churn, map.churnDays], [5, 2, 90]);
    assert.equal(map.nodes.find(({ name }) => name === 'App')?.metrics.churn, 1);
  });

  it('marks only what nothing depends on and nothing starts as unused', () => {
    const unused = map.nodes
      .filter(({ marks }) => marks.includes('unused'))
      .map(({ name }) => name);
    assert.deepEqual(unused.sort(), ['Mail', 'MailFeed', 'Sky', 'SkyFeed', 'queue-view']);
  });

  it('gives the same map when scanned again, apart from the time', async () => {
    const again = await scanProject(root, { scannedAt: '2030-01-01T00:00:00Z' });
    assert.notEqual(again.scannedAt, map.scannedAt);
    assert.deepEqual(withoutTime(again), withoutTime(map));
  });
});

describe('scanProject: outside a git checkout', () => {
  it('has no churn, and says so', async () => {
    const map = await scanProject(fixtureProject(FILES));
    assert.equal(map.churnDays, 0);
    assert.ok(map.nodes.every(({ metrics }) => metrics.churn === 0));
    assert.deepEqual(mapProblems(map), []);
  });
});
