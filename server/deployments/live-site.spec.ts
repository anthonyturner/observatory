import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type {
  DeploymentMark,
  DeploymentQuery,
  DeploymentReader,
  DeploymentState,
} from '../github/deployment-reader.ts';
import {
  LIVE_SITES_RETRY_MS,
  LIVE_SITES_TTL_MS,
  LIVE_SITE_SCAN,
  liveSiteUrl,
  liveSitesLifetime,
  liveSitesReport,
} from './live-site.ts';

const SHA = 'a'.repeat(40);
const mark = (id: number, environment: string, minute: number): DeploymentMark => ({
  id,
  environment,
  sha: SHA,
  ref: SHA,
  createdAt: `2026-10-08T12:${String(minute).padStart(2, '0')}:00Z`,
  creator: 'vercel[bot]',
});
const siteOf = (id: number): string => `https://deploy-${id}.example.com`;

interface Fake {
  readonly marks: readonly DeploymentMark[];
  readonly states?: Readonly<Record<number, DeploymentState>>;
  readonly environments?: () => Promise<string[]>;
  /** Statuses that name no address. */
  readonly withoutAddress?: boolean;
}

/** A reader over a fixed list, narrowing as GitHub does, that records the statuses it was asked for. */
function fakeReader(fake: Fake): DeploymentReader & { statusesRead: number[] } {
  const statusesRead: number[] = [];
  return {
    statusesRead,
    environments: fake.environments ?? (async () => []),
    deployments: async (_repo, query: DeploymentQuery) =>
      fake.marks
        .filter((each) => query.environment === undefined || each.environment === query.environment)
        .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
        .slice(0, query.limit),
    deploymentStatus: async (_repo, id) => {
      statusesRead.push(id);
      return {
        state: fake.states?.[id] ?? 'success',
        environmentUrl: fake.withoutAddress ? null : siteOf(id),
        logUrl: null,
        description: null,
        createdAt: '2026-10-08T12:59:00Z',
      };
    },
  };
}

describe('liveSiteUrl', () => {
  it('is the newest production deployment that went live', async () => {
    const github = fakeReader({
      marks: [mark(1, 'Production', 10), mark(2, 'Production', 20)],
      states: { 1: 'inactive' },
    });

    assert.equal(await liveSiteUrl(github, 'me/app'), siteOf(2));
    assert.deepEqual(github.statusesRead, [2], 'the older ones are not asked about');
  });

  it('ignores previews, even newer ones', async () => {
    const github = fakeReader({
      marks: [mark(1, 'Production', 10), mark(2, 'Preview', 30), mark(3, 'pr-12', 40)],
    });

    assert.equal(await liveSiteUrl(github, 'me/app'), siteOf(1));
  });

  it('passes over newer production deployments that are building or failed', async () => {
    const github = fakeReader({
      marks: [
        mark(1, 'Production', 10),
        mark(2, 'Production', 20),
        mark(3, 'Production', 30),
        mark(4, 'Production', 40),
      ],
      states: { 4: 'in_progress', 3: 'failure', 2: 'error' },
    });

    assert.equal(await liveSiteUrl(github, 'me/app'), siteOf(1));
  });

  it('is nothing when production never went live', async () => {
    const github = fakeReader({
      marks: [mark(1, 'Production', 10), mark(2, 'Production', 20), mark(3, 'Preview', 30)],
      states: { 1: 'failure', 2: 'queued' },
    });

    assert.equal(await liveSiteUrl(github, 'me/app'), null);
  });

  it('is nothing when only previews were deployed, or nothing was', async () => {
    assert.equal(
      await liveSiteUrl(fakeReader({ marks: [mark(1, 'Preview', 10)] }), 'me/app'),
      null,
    );
    assert.equal(await liveSiteUrl(fakeReader({ marks: [] }), 'me/app'), null);
  });

  it('is nothing for a live deployment that names no address', async () => {
    const github = fakeReader({ marks: [mark(1, 'Production', 10)], withoutAddress: true });

    assert.equal(await liveSiteUrl(github, 'me/app'), null);
  });

  it('finds production by its name in any case, and across more than one environment', async () => {
    const github = fakeReader({
      marks: [mark(1, 'Production – web', 10), mark(2, 'production-docs', 20)],
    });

    assert.equal(await liveSiteUrl(github, 'me/app'), siteOf(2));
  });

  it('finds production behind more than a hundred newer previews, by asking for its environment', async () => {
    const previews = Array.from({ length: 120 }, (_, index) =>
      mark(100 + index, `pr-${index}`, 30),
    );
    const github = fakeReader({
      marks: [mark(1, 'Production', 10), ...previews],
      environments: async () => ['Production'],
    });

    assert.equal(await liveSiteUrl(github, 'me/app'), siteOf(1));
  });

  it('looks at only a few of production’s newest deployments', async () => {
    const marks = Array.from({ length: LIVE_SITE_SCAN + 3 }, (_, index) =>
      mark(index + 1, 'Production', index + 10),
    );
    const github = fakeReader({
      marks,
      states: Object.fromEntries(marks.map((each) => [each.id, 'failure' as const])),
    });

    assert.equal(await liveSiteUrl(github, 'me/app'), null);
    assert.equal(github.statusesRead.length, LIVE_SITE_SCAN);
  });
});

describe('liveSitesReport', () => {
  const NOW = Date.parse('2026-10-10T09:00:00Z');
  const repo = (name: string, homepageUrl: string | null = null) => ({
    nameWithOwner: `me/${name}`,
    homepageUrl,
  });

  it('lists the site of each repository that has one, in order', async () => {
    const live = fakeReader({ marks: [mark(1, 'Production', 10)] });
    const previewsOnly = fakeReader({ marks: [mark(2, 'Preview', 10)] });
    const github: DeploymentReader = {
      ...live,
      deployments: (name, query) =>
        (name === 'me/quiet' ? previewsOnly : live).deployments(name, query),
    };

    const report = await liveSitesReport(github, [repo('app'), repo('quiet'), repo('site')], NOW);

    assert.equal(report.generatedAt, '2026-10-10T09:00:00.000Z');
    assert.deepEqual(report.sites, [
      { repo: 'me/app', url: siteOf(1) },
      { repo: 'me/site', url: siteOf(1) },
    ]);
    assert.equal(report.unreadCount, 0);
  });

  it('prefers the owner’s homepage to the production deployment, and asks GitHub nothing for it', async () => {
    const github = fakeReader({ marks: [mark(1, 'Production', 10)] });
    const asked: string[] = [];
    const counting: DeploymentReader = {
      ...github,
      environments: async (name) => (asked.push(name), []),
      deployments: async (name, query) => (asked.push(name), github.deployments(name, query)),
    };

    const report = await liveSitesReport(
      counting,
      [repo('app', ' https://app.example.com '), repo('other')],
      NOW,
    );

    assert.deepEqual(report.sites, [
      { repo: 'me/app', url: 'https://app.example.com' },
      { repo: 'me/other', url: siteOf(1) },
    ]);
    assert.ok(!asked.includes('me/app'), 'no deployment request for a repository with a homepage');
  });

  it('falls back to the deployment when the homepage is empty or not a web page', async () => {
    const github = fakeReader({ marks: [mark(1, 'Production', 10)] });

    const report = await liveSitesReport(
      github,
      [repo('a', ''), repo('b', 'javascript:alert(1)'), repo('c', 'ftp://files.example.com')],
      NOW,
    );

    assert.deepEqual(
      report.sites.map((site) => site.url),
      [siteOf(1), siteOf(1), siteOf(1)],
    );
  });

  it('leaves out a repository GitHub will not answer for, counts it, and keeps the others', async () => {
    const live = fakeReader({ marks: [mark(1, 'Production', 10)] });
    const github: DeploymentReader = {
      ...live,
      deployments: async (name, query) => {
        if (name === 'me/broken') throw new Error('HTTP 502');
        return live.deployments(name, query);
      },
    };
    const logged = console.error;
    console.error = () => undefined;
    try {
      const report = await liveSitesReport(github, [repo('broken'), repo('app')], NOW);

      assert.deepEqual(report.sites, [{ repo: 'me/app', url: siteOf(1) }]);
      assert.equal(report.unreadCount, 1);
    } finally {
      console.error = logged;
    }
  });
});

describe('liveSitesLifetime', () => {
  it('keeps a complete report a long while, and one with an unread repository only briefly', () => {
    const report = { generatedAt: 'x', sites: [], unreadCount: 0 };

    assert.equal(liveSitesLifetime(report), LIVE_SITES_TTL_MS);
    assert.equal(liveSitesLifetime({ ...report, unreadCount: 1 }), LIVE_SITES_RETRY_MS);
    assert.ok(LIVE_SITES_RETRY_MS < LIVE_SITES_TTL_MS);
  });
});
