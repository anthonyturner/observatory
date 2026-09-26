import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { CollisionsReport } from '../collisions/collisions-report.ts';
import type { GitHub } from '../github/github.ts';
import type { Frame } from '../history/frames.ts';
import type { HistoryStore } from '../history/history-store.ts';
import type { LogSnapshot } from '../logs/log-types.ts';
import { hostedApi } from '../hosted/hosted-api.ts';
import type { Store } from '../store/store.ts';
import { EMPTY_TRIAGE, type TriageState, applyTriage } from '../triage/triage.ts';
import type { TriageStore } from '../triage/triage-store.ts';
import type { UsageReport } from '../usage/usage-types.ts';
import { pushClient } from './push-client.ts';
import { type PushSources, pushAll } from './push-run.ts';

const PUSH_TOKEN = 'p'.repeat(32);
const SITE = 'https://observatory.example';
const UPDATED = '2026-09-20T00:00:00Z';
const HOSTED_AT = Date.parse('2026-09-26T00:00:00Z');
const LOCAL_AT = Date.parse('2026-09-25T00:00:00Z');

const ENV = {
  KV_REST_API_URL: 'https://kv.example',
  KV_REST_API_TOKEN: 'kv-token',
  GITHUB_TOKEN: 'gh-token',
  GITHUB_OWNER: 'me',
  GITHUB_CLIENT_ID: 'client',
  GITHUB_CLIENT_SECRET: 'client-secret',
  ALLOWED_LOGINS: 'me',
  SESSION_SECRET: 'k'.repeat(32),
  CRON_SECRET: 'c'.repeat(32),
  PUSH_TOKEN,
};

const github = {
  ownedRepos: async () => [{ name: 'app', nameWithOwner: 'me/app', isPrivate: false }],
  pullFiles: async () => [],
} as unknown as GitHub;

/** The hosted API in memory, reached as `fetch` would reach it. */
function hostedSite() {
  const data = new Map<string, unknown>();
  const store: Store = {
    get: async (key) => data.get(key) ?? null,
    set: async (key, value) => void data.set(key, structuredClone(value)),
  };
  const handle = hostedApi(ENV, () => ({ store, github }));
  const fetch = async (input: string | URL | Request, init?: RequestInit) =>
    handle(new Request(input, init));
  return { data, fetch };
}

function memoryTriage(state: TriageState): TriageStore & { current: () => TriageState } {
  let current = state;
  return {
    current: () => current,
    read: async () => current,
    write: async (_repo, next) => {
      current = next;
    },
  };
}

const frame: Frame = { at: '2026-09-24T00:00:00.000Z', items: [], departed: [] };
const usage: UsageReport = { generatedAt: 'x', limits: null, tokens: { days: 30, rows: [] } };
const logs: LogSnapshot = {
  generatedAt: 'x',
  source: 'App',
  span: { from: null, to: null },
  totals: { lines: 0, files: 0, error: 0, warn: 0, info: 0, faults: 0, omitted: 0 },
  windows: [],
  faults: [],
  timeline: [],
};
const checked: CollisionsReport = {
  generatedAt: 'x',
  repo: 'me/app',
  check: 'checked',
  pairs: [],
};

function sourcesFor(fetch: typeof globalThis.fetch, triage: TriageStore): PushSources {
  return {
    client: pushClient({ site: SITE, token: PUSH_TOKEN }, fetch),
    repos: async () => ['me/app'],
    triage,
    history: { read: async () => [frame] } as unknown as HistoryStore,
    collisions: async () => checked,
    logs: async () => logs,
    usage: async () => usage,
  };
}

describe('pushAll against the hosted API', () => {
  it('brings a hosted snooze home and sends up what only this machine knows', async () => {
    const site = hostedSite();
    const hostedSnooze = applyTriage(EMPTY_TRIAGE, 3, 'snooze', {
      now: HOSTED_AT,
      updatedAt: UPDATED,
      days: 2,
    });
    await pushClient({ site: SITE, token: PUSH_TOKEN }, site.fetch).send({
      repo: 'me/app',
      triage: hostedSnooze,
    });
    const local = memoryTriage(
      applyTriage(EMPTY_TRIAGE, 5, 'seen', { now: LOCAL_AT, updatedAt: UPDATED }),
    );

    const results = await pushAll(sourcesFor(site.fetch, local), null);

    assert.deepEqual(results, [
      {
        target: 'me/app',
        wrote: ['triage', '1 frames', 'collisions', 'logs'],
        broughtHome: true,
      },
      { target: 'usage', wrote: ['usage'], broughtHome: false },
    ]);
    assert.equal(local.current().snoozed['3'], '2026-09-28T00:00:00.000Z');
    const hosted = site.data.get('triage/me__app') as TriageState;
    assert.equal(hosted.seen['5'], '2026-09-25T00:00:00.000Z');
    assert.equal(hosted.snoozed['3'], '2026-09-28T00:00:00.000Z');
    assert.deepEqual(site.data.get('history/me__app'), { frames: [frame] });
    assert.deepEqual(site.data.get('usage/current'), usage);
    assert.deepEqual(site.data.get('logs/me__app'), logs);
  });

  it('pushes one repository without the usage, and reports a refusal without stopping', async () => {
    const site = hostedSite();
    const results = await pushAll(sourcesFor(site.fetch, memoryTriage(EMPTY_TRIAGE)), 'me/app');

    assert.equal(results.length, 1);

    const refused = await pushAll(
      {
        ...sourcesFor(site.fetch, memoryTriage(EMPTY_TRIAGE)),
        repos: async () => ['someone/else', 'me/app'],
      },
      null,
    );
    assert.match(
      String((refused[0] as { error: string }).error),
      /404 someone\/else is not charted/,
    );
    assert.equal(refused.length, 3);
  });

  it('sends no collisions it could not check, and no logs without a folder', async () => {
    const site = hostedSite();
    const sources = {
      ...sourcesFor(site.fetch, memoryTriage(EMPTY_TRIAGE)),
      collisions: async () => ({ ...checked, check: 'no-clone' as const }),
      logs: async () => ({ configured: false as const, reason: 'not-set' as const }),
    };

    const [result] = await pushAll(sources, 'me/app');

    assert.deepEqual(result, {
      target: 'me/app',
      broughtHome: false,
      wrote: ['triage', '1 frames'],
    });
  });

  it('fails plainly with a wrong token', async () => {
    const site = hostedSite();
    const sources = {
      ...sourcesFor(site.fetch, memoryTriage(EMPTY_TRIAGE)),
      client: pushClient({ site: SITE, token: 'wrong' }, site.fetch),
    };

    const [result] = await pushAll(sources, 'me/app');

    assert.match((result as { error: string }).error, /401 unauthorised/);
  });
});
