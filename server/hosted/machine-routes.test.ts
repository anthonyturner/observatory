import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { GitHub } from '../github/github.ts';
import type { QueuePull } from '../github/queue-reader.ts';
import type { Store } from '../store/store.ts';
import { EMPTY_TRIAGE, applyTriage } from '../triage/triage.ts';
import { hostedApi } from './hosted-api.ts';
import { sealer } from './sealed-value.ts';

const SESSION_SECRET = 'k'.repeat(32);
const CRON_SECRET = 'c'.repeat(32);
const PUSH_TOKEN = 'p'.repeat(32);
const SITE = 'https://observatory.example';

const ENV = {
  KV_REST_API_URL: 'https://kv.example',
  KV_REST_API_TOKEN: 'kv-token',
  GITHUB_TOKEN: 'gh-token',
  GITHUB_OWNER: 'me',
  GITHUB_CLIENT_ID: 'client',
  GITHUB_CLIENT_SECRET: 'client-secret',
  ALLOWED_LOGINS: 'me',
  SESSION_SECRET,
  CRON_SECRET,
  PUSH_TOKEN,
};

const pull = (number: number): QueuePull => ({
  number,
  title: `Change ${number}`,
  url: `https://github.com/me/app/pull/${number}`,
  mergeable: 'MERGEABLE',
  statusCheckRollup: [],
  closingIssuesReferences: [],
  updatedAt: '2026-09-25T00:00:00Z',
  isDraft: false,
  additions: 1,
  deletions: 1,
  createdAt: '2026-09-24T00:00:00Z',
  headRefName: `change-${number}`,
  baseRefName: 'main',
  changedFiles: 1,
});

const github = {
  ownedRepos: async () => [{ name: 'app', nameWithOwner: 'me/app', isPrivate: false }],
  openPulls: async () => [pull(1), pull(2)],
  queuePulls: async () => [pull(1), pull(2)],
  mergeableOf: async () => 'MERGEABLE',
  openIssueNumbers: async () => [],
  pullState: async () => ({ state: 'OPEN', title: 'Change' }),
  pullFiles: async () => [
    { number: 1, files: ['a.ts'] },
    { number: 2, files: ['a.ts'] },
  ],
} as unknown as GitHub;

function site(env: Record<string, string> = ENV) {
  const data = new Map<string, unknown>();
  const store: Store = {
    get: async (key) => data.get(key) ?? null,
    set: async (key, value) => void data.set(key, structuredClone(value)),
  };
  return { data, handle: hostedApi(env, () => ({ store, github })) };
}

const bearer = (secret: string) => ({ authorization: `Bearer ${secret}` });
const push = (handle: ReturnType<typeof site>['handle'], body: unknown, secret = PUSH_TOKEN) =>
  handle(
    new Request(`${SITE}/api/push`, {
      method: 'POST',
      headers: { ...bearer(secret), 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );
const owner = {
  cookie: `obs_session=${sealer(SESSION_SECRET).seal({ login: 'me', exp: Date.now() + 60_000 })}`,
};
const read = async (handle: ReturnType<typeof site>['handle'], path: string) =>
  (await handle(new Request(`${SITE}${path}`, { headers: owner }))).json();

describe('the cron route', () => {
  it('refuses a missing or wrong secret', async () => {
    const { handle } = site();

    assert.equal((await handle(new Request(`${SITE}/api/cron`))).status, 401);
    const wrong = new Request(`${SITE}/api/cron`, { headers: bearer(PUSH_TOKEN) });
    assert.equal((await handle(wrong)).status, 401);
  });

  it('refreshes every project and records its history', async () => {
    const { handle, data } = site();

    const response = await handle(
      new Request(`${SITE}/api/cron`, { headers: bearer(CRON_SECRET) }),
    );
    const body = (await response.json()) as { results: unknown[]; projects: number };

    assert.equal(response.status, 200);
    assert.deepEqual(body.results, [{ repo: 'me/app', open: 2 }]);
    assert.equal(body.projects, 1);
    assert.ok(data.has('history/me__app'));
  });
});

describe('the push routes', () => {
  it('refuse a missing or wrong token', async () => {
    const { handle } = site();

    assert.equal((await push(handle, {}, CRON_SECRET)).status, 401);
    assert.equal((await handle(new Request(`${SITE}/api/push?repo=me/app`))).status, 401);
  });

  it('hand out the hosted triage, and take pushed triage in by whichever changed last', async () => {
    const { handle } = site();
    const hostedAt = Date.parse('2026-09-25T00:00:00Z');
    const pushedAt = Date.parse('2026-09-26T00:00:00Z');
    const updated = { updatedAt: '2026-09-25T00:00:00Z' };
    await push(handle, {
      repo: 'me/app',
      triage: applyTriage(EMPTY_TRIAGE, 1, 'dismiss', { now: hostedAt, ...updated }),
    });

    await push(handle, {
      repo: 'me/app',
      triage: applyTriage(EMPTY_TRIAGE, 1, 'restore', { now: pushedAt, ...updated }),
    });
    const got = await handle(
      new Request(`${SITE}/api/push?repo=ME/App`, { headers: bearer(PUSH_TOKEN) }),
    );

    const { repo, triage } = (await got.json()) as { repo: string; triage: { dismissed: object } };
    assert.equal(repo, 'me/app');
    assert.deepEqual(triage.dismissed, {});
  });

  it('take frames, merge checks and usage, which the owner then sees', async () => {
    const { handle } = site();
    const frame = { at: '2026-09-20T00:00:00.000Z', items: [], departed: [] };
    const usage = {
      generatedAt: '2026-09-26T00:00:00Z',
      limits: null,
      tokens: { days: 30, rows: [] },
    };
    const collisions = {
      generatedAt: '2026-09-26T00:00:00Z',
      repo: 'me/app',
      check: 'checked',
      pairs: [{ a: 1, b: 2, files: ['a.ts'], conflicts: ['a.ts'] }],
    };

    const response = await push(handle, { repo: 'me/app', frames: [frame], collisions, usage });

    assert.deepEqual(await response.json(), { wrote: ['usage', '1 frames', 'collisions'] });
    assert.deepEqual(await read(handle, '/api/usage'), usage);
    const shown = (await read(handle, '/api/collisions?repo=me/app')) as typeof collisions;
    assert.equal(shown.check, 'checked');
    assert.deepEqual(shown.pairs[0].conflicts, ['a.ts']);
    const history = (await read(handle, '/api/history?repo=me/app')) as { frames: unknown[] };
    assert.deepEqual(history.frames[0], frame);
  });

  it('refuse a repository the site does not chart, and a malformed part', async () => {
    const { handle } = site();

    assert.equal((await push(handle, { repo: 'someone/else', frames: [] })).status, 404);
    assert.equal((await push(handle, { repo: 'me/app', collisions: { check: 'x' } })).status, 400);
    assert.equal((await push(handle, { usage: 'lots' })).status, 400);
    assert.equal((await push(handle, { triage: {} })).status, 400);
  });

  it('write nothing when any part is malformed', async () => {
    const { handle, data } = site();
    const usage = { generatedAt: 'x', limits: null, tokens: { days: 30, rows: [] } };

    const response = await push(handle, { repo: 'me/app', usage, collisions: { check: 'x' } });

    assert.equal(response.status, 400);
    assert.deepEqual([...data.keys()], []);
  });
});

describe('pushed logs', () => {
  const logs = {
    generatedAt: '2026-09-26T00:00:00Z',
    source: 'App',
    span: { from: null, to: null },
    totals: { lines: 1, files: 1, error: 1, warn: 0, info: 0, faults: 1, omitted: 0 },
    windows: [],
    faults: [
      { id: 1, level: 'error', window: 'api', service: null, text: 'mail bob@example.com bounced' },
    ],
    timeline: [],
  };
  const visitorLogs = async (handle: ReturnType<typeof site>['handle']) =>
    handle(new Request(`${SITE}/api/logs?repo=me/app`));

  it('read as not set until a push brings them, then as pushed, to the owner', async () => {
    const { handle } = site();
    assert.deepEqual(await read(handle, '/api/logs?repo=me/app'), {
      configured: false,
      reason: 'not-set',
    });

    await push(handle, { repo: 'me/app', logs });

    assert.deepEqual(await read(handle, '/api/logs?repo=me/app'), logs);
    assert.equal((await push(handle, { repo: 'me/app', logs: { source: 1 } })).status, 400);
  });

  it('reach a visitor only with PREVIEW_LOGS on, and then through the second scrub', async () => {
    const closed = site({ ...ENV, PUBLIC_PREVIEW: 'on' });
    const open = site({ ...ENV, PUBLIC_PREVIEW: 'on', PREVIEW_LOGS: 'on' });
    await push(closed.handle, { repo: 'me/app', logs });
    await push(open.handle, { repo: 'me/app', logs });

    assert.equal((await visitorLogs(closed.handle)).status, 403);
    const shown = (await (await visitorLogs(open.handle)).json()) as typeof logs;
    assert.equal(shown.faults[0].text, 'mail [hidden] bounced');
  });
});
